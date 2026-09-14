import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircle, ShieldCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { SearchBar } from './SearchBar';
import { WhatsAppButton } from './WhatsAppButton';
import { MobileDrawer } from './MobileDrawer';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { categories, settings } = useStore();
  const visualLabels = {
    'Camisetas de Time': 'Camisetas',
    'Camisetas de Time Retrô': 'Retrô',
    'Sapatilhas de Atletismo': 'Atletismo',
    'Chuteiras Infantil': 'Infantil',
    'Tabela de Conversão BR x EUR': 'Conversão',
    'Tênis de Corrida': 'Corrida',
    'Tênis Esportivo': 'Esportivo',
    'Tênis On Running e HOKA': 'On / HOKA',
    'Tênis Casuais - Senha: HJH001077': 'Tênis Casuais'
  };
  const location = useLocation();

  // Exibe as 4 primeiras categorias no menu principal de navegação
  const navCategories = categories.filter(
    (cat) =>
      cat.name !== 'Tênis de Corrida' &&
      cat.name !== 'Tênis Esportivo' &&
      cat.name !== 'Tênis Esportivos - Senha: 888888'
  );

  return (
    <header className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-md border-b border-brand-border/80">
      {/* Barra superior de anúncio */}
      <div className="bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple text-white py-1 px-4 text-center text-xs font-semibold tracking-wide">
        <span>⚡ CATÁLOGO OFICIAL LN SPORTS • ATENDIMENTO DIRETO VIA WHATSAPP</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex flex-col items-center gap-1 pt-4">
          
          {/* Botão Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-surface transition-colors self-start"
            aria-label="Abrir Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo LN SPORTS em Preto e Roxo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group relative z-10 mb-2">
            <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-brand-purple to-brand-purpleLight p-0.5 shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-brand-purple/30 group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-brand-dark rounded-[10px] flex items-center justify-center font-display font-black text-brand-purpleLight text-xl">
                LN
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tighter text-white leading-none">
                LN <span className="text-brand-purpleLight">SPORTS</span>
              </span>
              <span className="text-[10px] font-bold tracking-widest text-brand-muted uppercase">
                Outlet & Catálogo
              </span>
            </div>
          </Link>

          {/* Combined navigation and actions row */}
          <div className="flex w-full max-w-7xl items-center justify-center gap-6">
            {/* Navigation */}
            <nav className="hidden lg:flex gap-5 text-sm font-semibold overflow-x-auto whitespace-nowrap flex-nowrap">
              <Link
                to="/"
                className={`transition-colors py-1 ${
                  location.pathname === '/' ? 'text-brand-purpleLight border-b-2 border-brand-purpleLight' : 'text-slate-300 hover:text-white'
                }`}
              >
                Início
              </Link>
              {navCategories.map((cat) => (
                <Link
                  key={cat.id || cat.slug}
                  to={`/categoria/${cat.slug}`}
                  className={`transition-colors py-1 ${
                    location.pathname === `/categoria/${cat.slug}` ? 'text-brand-purpleLight border-b-2 border-brand-purpleLight' : 'text-slate-300 hover:text-white'
                  }`}
                  title={cat.name}
                >
                  {visualLabels[cat.name] || cat.name}
                </Link>
              ))}
            </nav>

            {/* Search and actions */}
            <div className="flex items-center gap-3">
              {/* Busca no Desktop */}
              <div className="flex-1 max-w-xs lg:max-w-sm">
                <SearchBar className="w-full" />
              </div>
              {/* Ações: WhatsApp e Admin */}
              <WhatsAppButton
                size="md"
                text="Atendimento"
                className="hidden sm:inline-flex"
              />
              <Link
                to="/admin"
                title="Painel Administrativo"
                className="p-2.5 rounded-xl text-brand-muted/70 hover:text-brand-purpleLight hover:bg-brand-surface transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Busca em linha no Mobile */}
        <div className="pb-3 md:hidden">
          <SearchBar className="w-full" />
        </div>
      </div>

      {/* Menu gaveta Mobile */}
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}
