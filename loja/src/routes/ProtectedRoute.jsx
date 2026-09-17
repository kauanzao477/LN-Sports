import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-4 border-brand-purple/20 border-t-brand-purpleLight animate-spin mb-4"></div>
        <p className="text-brand-muted text-sm font-medium animate-pulse">Verificando autorização LN SPORTS...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
