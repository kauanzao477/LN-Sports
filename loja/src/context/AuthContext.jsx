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
   * A validação de credenciais ocorre exclusivamente no backend via hash bcrypt.
   */
  const login = async (email, password) => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (email || '').trim(), password }),
      });

      if (res.ok) {
        const { token, email: adminEmail } = await res.json();
        const userObj = {
          uid: 'admin',
          email: adminEmail || email,
          displayName: 'Administrador LN SPORTS',
        };

        sessionStorage.setItem(SESSION_KEY, token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(userObj));
        setUser(userObj);
        setIsAdmin(true);
        return userObj;
      }

      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Credenciais inválidas. Verifique o e-mail e a senha informados.');
    } catch (e) {
      throw new Error(e.message || 'Erro ao comunicar com o servidor de autenticação.');
    }
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
