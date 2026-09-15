import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ShieldCheck, Heart } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { WhatsAppButton } from './WhatsAppButton';

export function Footer() {
  const { categories, settings } = useStore();

  return (
    <footer className="bg-brand-surface border-t border-brand-border mt-20 text-slate-400">
      {/* Banner de Atendimento WhatsApp */}
      <div className="border-b border-brand-border bg-gradient-to-r from-brand-surface via-brand-card to-brand-surface py-6 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <h3 className="text-lg lg:text-2xl font-display font-extrabold text-white mb-1">
              Dúvidas sobre tamanhos ou disponibilidade?
            </h3>
            <p className="text-slate-300 max-w-xl text-xs sm:text-sm">
              Nosso catálogo é digital e as compras são finalizadas diretamente com um atendente exclusivo no WhatsApp.
            </p>
          </div>
          <WhatsAppButton
            size="lg"
            text="Falar com Atendente"
            className="shrink-0"
          />
        </div>
      </div>

      {/* Links Institucionais e Categorias */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Coluna 1: Sobre */}
          <div className="md:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-purple to-brand-purpleLight flex items-center justify-center font-display font-black text-white text-lg">
                LN
              </div>
              <span className="font-display font-black text-xl tracking-wider text-white">
                LN <span className="text-brand-purpleLight">SPORTS</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-brand-muted">
              Plataforma de catálogo esportivo da LN SPORTS. Seleção exclusiva de camisas de futebol, retro, seleções e kits esportivos em alta qualidade.
            </p>
          </div>

          {/* Coluna 2: Categorias */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Categorias
            </h4>
            <ul className="space-y-2 text-xs">
              {categories.slice(0, 6).map((cat) => (
                <li key={cat.id || cat.slug}>
                  <Link
                    to={`/categoria/${cat.slug}`}
                    className="hover:text-brand-purpleLight transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3: Como Funciona */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Como Comprar
            </h4>
            <ul className="space-y-2 text-xs text-brand-muted">
              <li>1. Escolha o produto no catálogo</li>
              <li>2. Clique em "Comprar pelo WhatsApp"</li>
              <li>3. Confirme tamanho e modelo com o atendente</li>
              <li>4. Pagamento e envio combinados com segurança</li>
            </ul>
          </div>

          {/* Coluna 4: Informações Importantes */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
              Segurança & Atendimento
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              A LN SPORTS preza pelo atendimento humanizado e seguro. Não solicitamos dados de cartão ou senhas através do site.
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-brand-purpleLight hover:text-brand-purpleNeon transition-colors font-medium"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Acesso Administrativo</span>
            </Link>
          </div>
        </div>

        {/* Linha inferior de Copyright */}
        <div className="mt-12 pt-6 border-t border-brand-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-muted gap-4">
          <p>&copy; {new Date().getFullYear()} LN SPORTS. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1">
            Feito para atletas e colecionadores
          </p>
        </div>
      </div>
    </footer>
  );
}
