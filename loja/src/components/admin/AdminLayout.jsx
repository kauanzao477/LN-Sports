import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-dark flex">
      {/* Sidebar Desktop */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0">
        <AdminSidebar />
      </div>

      {/* Drawer Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-10 w-72">
            <AdminSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Mobile */}
        <div className="lg:hidden bg-brand-surface border-b border-brand-border p-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-card"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-display font-black text-white">
            LN <span className="text-brand-purpleLight">ADMIN</span>
          </span>
        </div>

        {/* Área de visualização das páginas admin */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
