import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles, MessageCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { BannerCarousel } from '../components/common/BannerCarousel';
import { ProductGrid } from '../components/product/ProductGrid';
import { WhatsAppButton } from '../components/common/WhatsAppButton';
import { productService } from '../services/productService';
import { useStore } from '../context/StoreContext';

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // loadingFeatured é independente de loading para evitar flicker:
  // os Destaques mostram skeleton até os 4 produtos corretos estarem prontos.
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const { categories, settings } = useStore();
  const [visibleCount, setVisibleCount] = useState(12);

  // ── Catálogo recente (polling em tempo real) ─────────────────────────────
  useEffect(() => {
    setLoading(true);
    const unsubscribeRecent = productService.subscribeProducts({
      status: 'all',
      limitCount: 16,
      callback: (items) => {
        setRecentProducts(items);
        setLoading(false);
      }
    });
    return () => {
      if (typeof unsubscribeRecent === 'function') unsubscribeRecent();
    };
  }, []);

  // ── Destaques: exatamente 4 produtos, 1 por categoria oficial diferente ──────
  // Roda UMA vez no mount (dependência []).
  // Não depende de `categories` do StoreContext — tem lista própria de candidatas.
  // `cancelled` evita atualizações de estado após desmontagem (StrictMode safe).
  useEffect(() => {
    let cancelled = false;

    // Candidatas ordenadas por preferência — categorias oficiais, sem Tênis Esportivos.
    const CANDIDATE_CATEGORIES = [
      'Camisetas de Time',
      'Camisetas de Time Retrô',
      'Chuteiras',
      'Chuteiras Infantil',
      'Tênis Casuais',
      'Tênis de Corrida',
      'Tênis On Running e HOKA',
      'Sapatilhas de Atletismo',
    ];

    const fetchDiverseFeatured = async () => {
      try {
        // Busca paralela: 1 produto de cada candidata
        const results = await Promise.allSettled(
          CANDIDATE_CATEGORIES.map(catName =>
            productService.getProducts({ category: catName, limitCount: 1, page: 1 })
          )
        );

        if (cancelled) return;

        // Pega as primeiras 4 que retornaram ao menos 1 produto
        const featured = [];
        for (const r of results) {
          if (featured.length >= 4) break;
          if (r.status === 'fulfilled') {
            const items = r.value?.data || [];
            if (items.length > 0) featured.push(items[0]);
          }
        }

        if (featured.length > 0) setFeaturedProducts(featured);
      } finally {
        if (!cancelled) setLoadingFeatured(false);
      }
    };

    fetchDiverseFeatured();

    return () => { cancelled = true; };
  }, []); // [] = uma única execução no mount, independente do polling do StoreContext

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />

      <main className="flex-1">

        {/* ═══ HERO SECTION ═══
            Mobile: ultra compacto — apenas título + botão comprar
            Desktop: versão completa com subtítulo, vantagens, etc.
        */}
        <section className="relative overflow-hidden border-b border-brand-border/60">

          {/* Luzes de fundo — apenas desktop */}
          <div className="hidden lg:block absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
          <div className="hidden lg:block absolute top-1/3 right-10 w-72 h-72 bg-brand-violet/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">

            {/* ── Mobile Hero: mínimo essencial ── */}
            <div className="lg:hidden py-5">
              {/* Tag compacta */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-surface border border-brand-purple/40 text-brand-purpleNeon text-[10px] font-extrabold uppercase tracking-widest mb-3">
                <Zap className="w-3 h-3 fill-current" />
                <span>Outlet Esportivo</span>
              </div>

              {/* Título mobile reduzido */}
              <h1 className="font-display font-black text-3xl tracking-tight text-white leading-tight mb-3">
                MANTOS &amp; ARTIGOS <br />
                <span className="text-gradient-purple">LN SPORTS</span>
              </h1>

              {/* Botão principal mobile */}
              <WhatsAppButton
                size="md"
                text="Comprar pelo WhatsApp"
                className="w-full justify-center"
              />
            </div>

            {/* ── Desktop Hero: completo ── */}
            <div className="hidden lg:block pt-16 pb-24">
              {/* Tag superior */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-surface border border-brand-purple/40 text-brand-purpleNeon text-xs font-extrabold uppercase tracking-widest mb-6 shadow-purple-glow">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Outlet Esportivo de Alta Performance</span>
              </div>

              {/* Título Principal */}
              <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl mx-auto leading-[1.1] mb-6">
                MANTOS &amp; ARTIGOS <br />
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

              {/* Vantagens — apenas desktop */}
              <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-12 pt-8 border-t border-brand-border/40 text-xs text-slate-300">
                <div className="flex items-center justify-center gap-2">
                  <Shirt className="w-4 h-4 text-brand-purpleLight" />
                  <span>Fotos Reais de Alta Resolução</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4 text-brand-whatsapp" />
                  <span>Atendimento 100% Humano</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-purpleNeon" />
                  <span>Envio Seguro para todo Brasil</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ═══ CARROSSEL DE BANNERS (embaixo da descrição) ═══ */}
        <BannerCarousel />

        {/* ═══ SEÇÃO DE CATEGORIAS ═══
            Mobile: chips scrolláveis horizontais ultra-compactos (já exibidos no header, mas aqui como seção visual)
            Desktop: grid de cards
        */}
        <section id="categorias" className="border-b border-brand-border/40">

          {/* Mobile: strip horizontal de categorias */}
          <div className="lg:hidden px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-2">Categorias</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {categories.map((cat) => (
                <Link
                  key={cat.id || cat.slug}
                  to={`/categoria/${cat.slug}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-purple/50 text-slate-200 text-xs font-semibold shrink-0 transition-all hover:text-brand-purpleLight"
                >
                  <Shirt className="w-3.5 h-3.5 text-brand-purpleLight shrink-0" />
                  <span className="whitespace-nowrap">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop: grid de cards */}
          <div className="hidden lg:block py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  {cat.productCount ? (
                    <p className="text-xs text-brand-muted mt-1">
                      {cat.productCount.toLocaleString('pt-BR')} modelos
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SEÇÃO DE DESTAQUES ═══ */}
        <section className="py-6 lg:py-12 bg-brand-surface/40 border-b border-brand-border/60">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4 lg:mb-8">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-7 h-7 lg:w-9 lg:h-9 rounded-xl bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-brand-purpleLight">
                  <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div>
                  <h2 className="text-lg lg:text-3xl font-display font-extrabold text-white leading-tight">
                    Destaques
                  </h2>
                  <p className="hidden lg:block text-xs sm:text-sm text-brand-muted mt-0.5">
                    Modelos mais procurados e edições especiais selecionadas
                  </p>
                </div>
              </div>
            </div>

            <ProductGrid
              products={featuredProducts}
              loading={loadingFeatured}
              skeletonCount={4}
              emptyTitle="Nenhum destaque ativo no momento"
              emptyMessage="Os administradores da LN SPORTS estão atualizando os lançamentos."
            />
          </div>
        </section>

        {/* ═══ SEÇÃO DO CATÁLOGO COMPLETO ═══ */}
        <section className="py-6 lg:py-14 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 lg:mb-8">
            <div>
              <h2 className="text-lg lg:text-3xl font-display font-extrabold text-white">
                Catálogo Disponível
              </h2>
              <p className="text-xs text-brand-muted mt-0.5 lg:mt-1">
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
                className="px-6 py-2.5 rounded-xl bg-brand-surface hover:bg-brand-card text-white font-semibold text-sm border border-brand-border hover:border-brand-purple/50 transition-all"
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
