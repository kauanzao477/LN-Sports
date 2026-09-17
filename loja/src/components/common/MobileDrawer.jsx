import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronRight, ShieldCheck, Instagram } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { WhatsAppButton } from './WhatsAppButton';

export function MobileDrawer({ isOpen, onClose }) {
  const { categories, settings } = useStore();

  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Travar scroll do body quando aberto
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const seenSlugs = new Set();
  const validCategories = categories.filter((cat) => {
    if (!cat?.slug || !cat?.name) return false;
    if (cat.name === 'Tênis de Corrida' || cat.name === 'Tênis Esportivo') return false;
    if (cat.name?.includes('Senha:') || cat.slug?.includes('senha')) return false;
    if (seenSlugs.has(cat.slug)) return false;
    seenSlugs.add(cat.slug);
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer deslizante */}
      <div
        className="fixed inset-y-0 left-0 w-[80%] max-w-[320px] bg-brand-surface border-r border-brand-border flex flex-col shadow-2xl z-10"
        style={{ animation: 'slideInFromLeft 0.25s ease-out' }}
      >
        {/* Topo do Drawer */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-purple to-brand-purpleNeon flex items-center justify-center font-display font-black text-white text-sm">
              LN
            </div>
            <span className="font-display font-black text-lg tracking-tight text-white">
              LN <span className="text-brand-purpleLight">SPORTS</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-muted hover:text-white hover:bg-brand-card transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links de navegação */}
        <div className="flex-1 overflow-y-auto py-2">
          
          {/* Início */}
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center justify-between px-4 py-3 text-white font-medium hover:bg-brand-card hover:text-brand-purpleLight transition-colors text-sm"
          >
            <span>🏠 Início</span>
            <ChevronRight className="w-4 h-4 text-brand-muted shrink-0" />
          </Link>

          {/* Divider com label */}
          <div className="px-4 py-2 mt-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purpleLight">
              Categorias
            </p>
          </div>

          {/* Lista de categorias */}
          {validCategories.map((cat) => (
            <Link
              key={cat.id || cat.slug}
              to={`/categoria/${cat.slug}`}
              onClick={onClose}
              className="flex items-center justify-between px-4 py-3 text-slate-200 hover:bg-brand-card hover:text-brand-purpleLight transition-colors text-sm"
            >
              <span>{cat.name}</span>
              <ChevronRight className="w-4 h-4 text-brand-muted shrink-0" />
            </Link>
          ))}
        </div>

        {/* Rodapé do Drawer */}
        <div className="border-t border-brand-border p-4 space-y-3 bg-brand-dark/60">
          <WhatsAppButton
            text="Falar no WhatsApp"
            className="w-full justify-center py-3"
          />

          <a
            href={settings?.instagramUrl || 'https://www.instagram.com/ln.sportsss/'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-surface hover:bg-brand-card text-white text-xs font-bold border border-brand-border hover:border-pink-500/40 transition-colors"
          >
            <Instagram className="w-4 h-4 text-pink-400" />
            <span>Siga @ln.sportsss</span>
          </a>

          <div className="flex items-center justify-between text-xs text-brand-muted pt-1">
            <span>LN SPORTS © 2026</span>
            <Link
              to="/admin"
              onClick={onClose}
              className="flex items-center gap-1 hover:text-brand-purpleLight transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
