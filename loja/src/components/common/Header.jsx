import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { SearchBar } from './SearchBar';
import { WhatsAppButton } from './WhatsAppButton';
import { MobileDrawer } from './MobileDrawer';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { categories, settings } = useStore();

  const visualLabels = {
    'Camisetas de Time': 'Camisetas',
    'Camisetas de Time Retrô': 'Retrô',
    'Chuteiras': 'Chuteiras',
    'Chuteiras Infantil': 'Infantil',
    'Sapatilhas de Atletismo': 'Atletismo',
    'Tênis Casuais': 'Tênis Casuais',
    'Tênis On Running e HOKA': 'On / HOKA',
    'Tênis Esportivos': 'Tênis Esportivos',
    'Tabela de Conversão BR x EUR': 'Conversão',
  };
  const location = useLocation();

  // Fechar busca mobile ao navegar
  useEffect(() => {
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Exibe as categorias no menu de navegação desktop — apenas categorias oficiais
  const navCategories = categories.filter(
    (cat) =>
      cat.name !== 'Tênis de Corrida' &&
      cat.name !== 'Tênis Esportivo' &&
      !cat.name?.includes('Senha:') &&
      !cat.slug?.includes('senha')
  );

  return (
    <header className="sticky top-0 z-40 bg-brand-dark/97 backdrop-blur-md border-b border-brand-border/80">
      
      {/* Barra de anúncio — apenas desktop */}
      <div className="hidden lg:block bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple text-white py-1 px-4 text-center text-xs font-semibold tracking-wide">
        <span>⚡ CATÁLOGO OFICIAL LN SPORTS • ATENDIMENTO DIRETO VIA WHATSAPP</span>
      </div>

      {/* ═══ HEADER MOBILE — layout compacto horizontal ═══ */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          
          {/* Logo compacta */}
          <Link to="/" className="flex items-center gap-1.5 shrink-0 mr-auto group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-purple to-brand-purpleLight flex items-center justify-center font-display font-black text-white text-sm shadow-md group-hover:scale-105 transition-transform">
              LN
            </div>
            <span className="font-display font-black text-lg tracking-tight text-white leading-none">
              LN <span className="text-brand-purpleLight">SPORTS</span>
            </span>
          </Link>

          {/* Botão de busca mobile */}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className={`p-2 rounded-xl transition-colors ${
              mobileSearchOpen
                ? 'bg-brand-purple text-white'
                : 'text-brand-muted hover:text-white hover:bg-brand-surface'
            }`}
            aria-label="Buscar"
          >
            {mobileSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          {/* Botão menu mobile */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-surface transition-colors"
            aria-label="Abrir Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Busca expandível no mobile — uma única instância */}
        {mobileSearchOpen && (
          <div className="px-3 pb-3 border-t border-brand-border/50 pt-2.5">
            <SearchBar className="w-full" placeholder="Buscar camisas, times, seleções..." />
          </div>
        )}

        {/* Chips de categorias horizontais scrolláveis no mobile */}
        <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none">
          <Link
            to="/"
            className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
              location.pathname === '/'
                ? 'bg-brand-purple text-white'
                : 'bg-brand-surface text-slate-300 border border-brand-border hover:border-brand-purple/50'
            }`}
          >
            Início
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id || cat.slug}
              to={`/categoria/${cat.slug}`}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                location.pathname === `/categoria/${cat.slug}`
                  ? 'bg-brand-purple text-white'
                  : 'bg-brand-surface text-slate-300 border border-brand-border hover:border-brand-purple/50'
              }`}
            >
              {visualLabels[cat.name] || cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* ═══ HEADER DESKTOP — layout original preservado ═══ */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-1 pt-4">

          {/* Logo LN SPORTS */}
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
                Outlet &amp; Catálogo
              </span>
            </div>
          </Link>

          {/* Navigation e ações desktop */}
          <div className="flex w-full max-w-7xl items-center justify-center gap-6">
            {/* Navigation */}
            <nav className="flex gap-5 text-sm font-semibold overflow-x-auto whitespace-nowrap flex-nowrap">
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

            {/* Search e ações desktop */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-xs lg:max-w-sm">
                <SearchBar className="w-full" />
              </div>
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

          {/* Padding bottom desktop */}
          <div className="pb-3" />
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
