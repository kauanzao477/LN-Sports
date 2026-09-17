import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, ShieldCheck, Tag, Sparkles, ArrowLeft } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ProductGallery } from '../components/product/ProductGallery';
import { ProductGrid } from '../components/product/ProductGrid';
import { WhatsAppButton } from '../components/common/WhatsAppButton';
import { productService } from '../services/productService';
import { getProductWhatsAppUrl } from '../services/whatsappService';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { slugify } from '../utils/slugify';

export function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useStore();
  const { isAdmin } = useAuth();

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        window.scrollTo(0, 0);
        const item = await productService.getProductBySlug(slug);
        setProduct(item);
        if (item) {
          const relatedItems = await productService.getRelatedProducts(item, 4);
          setRelated(relatedItems);
        }
      } catch (e) {
        console.error("Erro ao carregar produto:", e);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-dark">
        <Header />
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-brand-purple/20 border-t-brand-purpleLight animate-spin"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-dark">
        <Header />
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-display font-black text-white mb-3">Produto Não Encontrado</h2>
          <p className="text-sm text-brand-muted mb-6">Este modelo pode estar esgotado ou ter sido movido.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-purple text-white font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Catálogo
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const whatsappUrl = getProductWhatsAppUrl(product, settings);

  const handleSetMainImage = (index) => {
    productService.saveMainImageIndex(product.sourceUrl, product.slug, index);
    setProduct(prev => ({ ...prev, mainImageIndex: index }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 sm:pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-brand-muted mb-8 overflow-x-auto whitespace-nowrap scrollbar-thin">
          <Link to="/" className="hover:text-white transition-colors">Início</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          {product.category && (
            <>
              <Link to={`/categoria/${slugify(product.category)}`} className="hover:text-white transition-colors">
                {product.category}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </>
          )}
          <span className="text-slate-200 font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Grade do Produto: Galeria à esquerda, Informações à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Coluna da Galeria de Fotos */}
          <div className="lg:col-span-7">
            <ProductGallery
              images={product.images}
              productName={product.name}
              mainImageIndex={product.mainImageIndex ?? 0}
              onSetMainImage={isAdmin ? handleSetMainImage : null}
            />
          </div>

          {/* Coluna de Informações e Compra via WhatsApp */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Badges de Categoria e Subcategoria */}
              <div className="flex flex-wrap items-center gap-2">
                {product.category && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-surface border border-brand-purple/40 text-brand-purpleNeon">
                    <Tag className="w-3 h-3" />
                    <span>{product.category}</span>
                  </span>
                )}
                {product.subcategory && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-surface border border-brand-border text-brand-purpleLight">
                    {product.subcategory}
                  </span>
                )}
                {product.featured && (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-brand-purple text-white">
                    Destaque
                  </span>
                )}
              </div>

              {/* Título do Produto */}
              <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white leading-tight">
                {product.name}
              </h1>

              {/* Caixa Informativa Oficial do WhatsApp */}
              <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-3">
                <div className="flex items-center gap-2.5 text-brand-whatsapp text-sm font-extrabold uppercase tracking-wider">
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>Compra Direta com Atendente</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Para consultar disponibilidade de tamanhos, prazos de entrega e valores atualizados, clique no botão abaixo para iniciar uma conversa no WhatsApp com nossa equipe.
                </p>

                {/* Botão de Compra no Desktop */}
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-brand-whatsapp hover:bg-brand-whatsappHover text-white text-base font-extrabold shadow-xl shadow-brand-whatsapp/30 hover:shadow-brand-whatsapp/50 transition-all duration-200 active:scale-98"
                  >
                    <MessageCircle className="w-6 h-6 fill-current shrink-0" />
                    <span>COMPRAR PELO WHATSAPP</span>
                  </a>
                </div>
              </div>

              {/* Descrição do Produto (se informada) */}
              {product.description && (
                <div className="space-y-2 pt-4 border-t border-brand-border">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                    Detalhes do Manto
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Selos de Confiança */}
              <div className="pt-4 border-t border-brand-border grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-purpleLight" />
                  <span>Fotos 100% Reais</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-purpleNeon" />
                  <span>Acabamento Premium</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO: PRODUTOS RELACIONADOS */}
        {related.length > 0 && (
          <div className="mt-20 pt-12 border-t border-brand-border/60">
            <h2 className="text-2xl font-display font-extrabold text-white mb-8">
              Modelos Semelhantes
            </h2>
            <ProductGrid products={related} />
          </div>
        )}
      </main>

      {/* BARRA FIXA DE WHATSAPP NO MOBILE (MOBILE-FIRST) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-surface/95 backdrop-blur-lg border-t border-brand-border p-3 flex items-center gap-3 shadow-2xl">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{product.name}</p>
          <p className="text-[10px] text-brand-whatsapp font-semibold">Atendimento Disponível</p>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-brand-whatsapp hover:bg-brand-whatsappHover text-white text-xs font-black shadow-lg shadow-brand-whatsapp/30 shrink-0"
        >
          <MessageCircle className="w-4 h-4 fill-current shrink-0" />
          <span>COMPRAR NO WHATSAPP</span>
        </a>
      </div>

      <Footer />
    </div>
  );
}
