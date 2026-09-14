import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { ProductPage } from './pages/ProductPage';
import { SearchPage } from './pages/SearchPage';

// Admin
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Contexts
import { StoreProvider } from './context/StoreContext';
import { AuthProvider } from './context/AuthContext';

export function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/categoria/:slug" element={<CategoryPage />} />
            <Route path="/produto/:slug" element={<ProductPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/busca" element={<SearchPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            {/* Protected admin area */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;
