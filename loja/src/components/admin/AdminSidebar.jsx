import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Shirt,
  FolderTree,
  Settings,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AdminSidebar({ onClose }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/produtos', label: 'Produtos', icon: Shirt },
    { to: '/admin/categorias', label: 'Categorias', icon: FolderTree },
    { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <aside className="w-64 bg-brand-surface border-r border-brand-border flex flex-col justify-between h-full">
      <div>
        {/* Topo do Menu Admin */}
        <div className="p-6 border-b border-brand-border">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-purpleLight flex items-center justify-center font-display font-black text-white text-lg shadow-md shadow-brand-purple/30">
              LN
            </div>
            <div>
              <span className="font-display font-black text-lg tracking-wider text-white">
                LN <span className="text-brand-purpleLight">ADMIN</span>
              </span>
              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">
                Gestão do Catálogo
              </p>
            </div>
          </Link>
        </div>

        {/* Links do Menu */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/30'
                      : 'text-slate-300 hover:text-white hover:bg-brand-card'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Rodapé da Sidebar */}
      <div className="p-4 border-t border-brand-border space-y-2 bg-brand-dark/40">
        <Link
          to="/"
          target="_blank"
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-brand-muted hover:text-white hover:bg-brand-card transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Visualizar Loja
          </span>
          <span className="text-[10px] bg-brand-border px-1.5 py-0.5 rounded text-slate-300">Público</span>
        </Link>

        <div className="pt-2 flex items-center justify-between text-xs text-brand-muted">
          <span className="truncate max-w-[140px]" title={user?.email || 'Admin'}>
            {user?.email || 'admin@lnsports.com'}
          </span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            title="Sair do Painel"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
