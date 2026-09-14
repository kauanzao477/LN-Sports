import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Monitora alterações de autenticação no Firebase
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            // 1. Verifica Custom Claim admin: true
            const tokenResult = await currentUser.getIdTokenResult();
            if (tokenResult.claims.admin === true) {
              setIsAdmin(true);
            } else if (db) {
              // 2. Fallback: verifica se o UID consta na coleção 'admins'
              const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
              setIsAdmin(adminDoc.exists());
            } else {
              setIsAdmin(false);
            }
          } catch (e) {
            console.error("[AuthContext] Erro ao validar privilégios admin:", e);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Modo demonstração local para desenvolvimento
      const savedSession = sessionStorage.getItem('ln_sports_admin_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          setUser(parsed);
          setIsAdmin(true);
        } catch (e) {}
      }
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    if (isFirebaseConfigured && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const currentUser = userCredential.user;

      // Validação de permissões administrativas
      const tokenResult = await currentUser.getIdTokenResult();
      let adminStatus = tokenResult.claims.admin === true;

      if (!adminStatus && db) {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        adminStatus = adminDoc.exists();
      }

      if (!adminStatus) {
        await firebaseSignOut(auth);
        throw new Error("Acesso negado: Este usuário não possui privilégios de administrador.");
      }

      setUser(currentUser);
      setIsAdmin(true);
      return currentUser;
    } else {
      // Validação em modo local/demo (sem credenciais hardcoded em produção)
      if (email.toLowerCase().includes('admin') && password.length >= 6) {
        const demoUser = {
          uid: 'demo-admin-uid',
          email: email,
          displayName: 'Administrador LN SPORTS'
        };
        sessionStorage.setItem('ln_sports_admin_session', JSON.stringify(demoUser));
        setUser(demoUser);
        setIsAdmin(true);
        return demoUser;
      }
      throw new Error("Credenciais inválidas. Em modo local, utilize um e-mail contendo 'admin' e senha com no mínimo 6 dígitos.");
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    }
    sessionStorage.removeItem('ln_sports_admin_session');
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
