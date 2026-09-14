import React from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronRight, MessageCircle, ShieldCheck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { WhatsAppButton } from './WhatsAppButton';

export function MobileDrawer({ isOpen, onClose }) {
  const { categories, settings } = useStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop escuro com desfoque */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer deslizante preto e roxo */}
      <div className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-brand-surface border-r border-brand-border flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-300">
        {/* Topo do Drawer */}
        <div className="p-4 border-b border-brand-border flex items-center justify-between">
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-purple to-brand-purpleNeon flex items-center justify-center font-display font-black text-white text-lg">
              LN
            </div>
            <span className="font-display font-black text-xl tracking-wider text-white">
              LN <span className="text-brand-purpleLight">SPORTS</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-brand-muted hover:text-white hover:bg-brand-card transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Links de navegação */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-purpleLight mb-3">
              Categorias em Destaque
            </h4>
            <div className="space-y-1">
              <Link
                to="/"
                onClick={onClose}
                className="flex items-center justify-between p-3 rounded-xl text-white font-medium hover:bg-brand-card hover:text-brand-purpleLight transition-colors"
              >
                <span>Início / Destaques</span>
                <ChevronRight className="w-4 h-4 text-brand-muted" />
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id || cat.slug}
                  to={`/categoria/${cat.slug}`}
                  onClick={onClose}
                  className="flex items-center justify-between p-3 rounded-xl text-slate-200 font-medium hover:bg-brand-card hover:text-brand-purpleLight transition-colors"
                >
                  <span>{cat.name}</span>
                  <ChevronRight className="w-4 h-4 text-brand-muted" />
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-brand-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-3">
              Atendimento Humanizado
            </h4>
            <WhatsAppButton
              text="Falar no WhatsApp"
              className="w-full justify-center py-3"
            />
            <p className="text-[11px] text-brand-muted mt-2 text-center">
              Tire dúvidas sobre tamanhos, fotos e modelos diretamente com um atendente.
            </p>
          </div>
        </div>

        {/* Rodapé do menu mobile */}
        <div className="p-4 border-t border-brand-border bg-brand-dark/60 flex items-center justify-between text-xs text-brand-muted">
          <span>LN SPORTS &copy; 2026</span>
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
  );
}
