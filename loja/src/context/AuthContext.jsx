/**
 * AuthContext — Autenticação do painel administrativo LN SPORTS.
 * Usa JWT via API REST (POST /api/admin/login).
 * Sem dependência do Firebase Auth.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const SESSION_KEY = 'ln_sports_admin_token';
const USER_KEY    = 'ln_sports_admin_user';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Restaura sessão do sessionStorage ao montar
  useEffect(() => {
    try {
      const token    = sessionStorage.getItem(SESSION_KEY);
      const userJson = sessionStorage.getItem(USER_KEY);
      if (token && userJson) {
        const parsed = JSON.parse(userJson);
        // Verifica expiração básica do JWT (sem lib — apenas decodifica o payload)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && Date.now() / 1000 < payload.exp) {
            setUser(parsed);
            setIsAdmin(true);
          } else {
            // Token expirado — limpa sessão
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(USER_KEY);
          }
        }
      }
    } catch (e) {
      // Se qualquer erro, começa sem sessão
    }
    setLoading(false);
  }, []);

  /**
   * Login via POST /api/admin/login.
   * Em modo demo (sem DB configurado), aceita qualquer email com "admin" e senha ≥6 chars.
   */
  const login = async (email, password) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro de autenticação' }));
      throw new Error(err.error || 'Credenciais inválidas');
    }

    const { token, email: adminEmail, demo } = await res.json();

    const userObj = {
      uid: 'admin',
      email: adminEmail,
      displayName: 'Administrador LN SPORTS',
      demo: !!demo,
    };

    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setUser(userObj);
    setIsAdmin(true);
    return userObj;
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(USER_KEY);
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
