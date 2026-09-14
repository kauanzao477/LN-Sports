import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles, MessageCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ProductGrid } from '../components/product/ProductGrid';
import { WhatsAppButton } from '../components/common/WhatsAppButton';
import { productService } from '../services/productService';
import { useStore } from '../context/StoreContext';

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { categories, settings } = useStore();
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setLoading(true);

    // Assinatura em tempo real para produtos publicados
    const unsubscribeRecent = productService.subscribeProducts({
      status: 'all', // Permite que novidades sendo catalogadas apareçam em tempo real
      limitCount: 16,
      callback: (items) => {
        setRecentProducts(items);
        const feat = items.filter(p => p.featured || p.status === 'published');
        setFeaturedProducts(feat.length > 0 ? feat.slice(0, 8) : items.slice(0, 4));
        setLoading(false);
      }
    });

    return () => {
      if (typeof unsubscribeRecent === 'function') unsubscribeRecent();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />

      <main className="flex-1">
        {/* HERO SECTION - Preto e Roxo Esportivo */}
        <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 border-b border-brand-border/60">
          {/* Luzes de fundo violeta/roxo */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-72 h-72 bg-brand-violet/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            
            {/* Tag superior */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-surface border border-brand-purple/40 text-brand-purpleNeon text-xs font-extrabold uppercase tracking-widest mb-6 shadow-purple-glow">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Outlet Esportivo de Alta Performance</span>
            </div>

            {/* Título Principal */}
            <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl mx-auto leading-[1.1] mb-6">
              MANTOS & ARTIGOS <br />
              <span className="text-gradient-purple">LN SPORTS</span>
            </h1>

            {/* Subtítulo */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
              Catálogo digital completo com fotos reais em alta resolução. Camisas de futebol nacionais, internacionais, retrô e kits exclusivos com atendimento direto via WhatsApp.
            </p>

            {/* Botões do Hero */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <WhatsAppButton
                size="lg"
                text="Comprar pelo WhatsApp"
                className="w-full sm:w-auto px-8"
              />
              <a
                href="#categorias"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-surface hover:bg-brand-card text-white text-base font-bold border border-brand-border hover:border-brand-purpleLight transition-all"
              >
                <span>Ver Categorias</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Vantagens */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12 pt-8 border-t border-brand-border/40 text-xs text-slate-300">
              <div className="flex items-center justify-center gap-2">
                <Shirt className="w-4 h-4 text-brand-purpleLight" />
                <span>Fotos Reais de Alta Resolução</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4 text-brand-whatsapp" />
                <span>Atendimento 100% Humano</span>
              </div>
              <div className="col-span-2 md:col-span-1 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-purpleNeon" />
                <span>Envio Seguro para todo Brasil</span>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 1: CATEGORIAS */}
        <section id="categorias" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                Categorias Oficiais
              </h2>
              <p className="text-xs sm:text-sm text-brand-muted mt-1">
                Explore o catálogo por clubes, seleções ou edições especiais
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id || cat.slug}
                to={`/categoria/${cat.slug}`}
                className="group glass-card p-5 rounded-2xl border border-brand-border hover:border-brand-purple/60 transition-all duration-300 hover:shadow-purple-glow hover:-translate-y-1"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border group-hover:border-brand-purple/40 flex items-center justify-center text-brand-purpleLight mb-3 transition-colors">
                  <Shirt className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-white text-base group-hover:text-brand-purpleLight transition-colors">
                  {cat.name}
                </h3>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <p className="text-xs text-brand-muted mt-1 truncate">
                    {cat.subcategories.slice(0, 3).join(', ')}...
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* SEÇÃO 2: PRODUTOS EM DESTAQUE */}
        <section className="py-12 bg-brand-surface/40 border-y border-brand-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-brand-purpleLight">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                    Destaques da Semana
                  </h2>
                  <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                    Modelos mais procurados e edições especiais selecionadas
                  </p>
                </div>
              </div>
            </div>

            <ProductGrid
              products={featuredProducts.length > 0 ? featuredProducts : recentProducts.slice(0, 4)}
              loading={loading}
              emptyTitle="Nenhum destaque ativo no momento"
              emptyMessage="Os administradores da LN SPORTS estão atualizando os lançamentos."
            />
          </div>
        </section>

        {/* SEÇÃO 3: NOVIDADES / CATÁLOGO RECENTE */}
        <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                Catálogo Disponível
              </h2>
              <p className="text-xs sm:text-sm text-brand-muted mt-1">
                Confira os mantos publicados recentemente
              </p>
            </div>
          </div>

          <ProductGrid
            products={recentProducts.slice(0, visibleCount)}
            loading={loading}
          />
          {!loading && recentProducts.length > visibleCount && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setVisibleCount(v => v + 12)}
                className="px-6 py-2 rounded-xl bg-brand-surface hover:bg-brand-card text-white transition"
              >
                Ver Mais
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
