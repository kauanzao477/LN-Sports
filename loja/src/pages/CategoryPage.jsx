import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Filter, ArrowUpDown } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ProductGrid } from '../components/product/ProductGrid';
import { ConversionInfoPage } from './ConversionInfoPage';
import { productService, PRODUCTS_PER_PAGE, getProductSubcategory, normalizeStr } from '../services/productService';
import { categoryService } from '../services/categoryService';

import { slugify } from '../utils/slugify';

export function CategoryPage() {
  const { slug, subcategorySlug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  // Ref to track the latest load request for the product subscription
  const loadIdRef = useRef(0);

  // Carrega informações da categoria
  useEffect(() => {
    async function loadCat() {
      const found = await categoryService.getCategoryBySlug(slug);
      setCategory(found || { name: slug.replace(/-/g, ' ').toUpperCase(), slug });
    }
    loadCat();
    // When slug (i.e., category) changes, reset subcategory and pagination state
    setSelectedSubcategory(null);
    setCurrentPage(1);
    // DEBUG: log category slug change
    console.log('[CategoryPage] slug changed:', slug);
  }, [slug]);

  // Carrega produtos da categoria em tempo real
  useEffect(() => {
    // Skip product loading for conversion info page
    if (category?.slug === 'tabela-de-conversao-br-x-eur') return;
    // Guard ref to discard callbacks once this effect is cleaned up
    const active = { current: true };
    if (!category) return;
    setLoading(true);
    // Invalida imediatamente a lista anterior
    setProducts([]);
    // Identificador único para esta carga
    const loadId = Date.now();
    loadIdRef.current = loadId;

    const unsubscribe = productService.subscribeProducts({
      status: 'all',
      category: category.name,
      callback: (items) => {
        // Se o efeito já foi limpo, ignore
        if (!active.current) return;
        // Ignora callbacks de carregamentos anteriores
        if (loadIdRef.current !== loadId) return;
        // DEBUG: log subscription callback details
        console.log('[CategoryPage] received', items.length, 'items for category', category?.name);
        console.log('[CategoryPage] first items IDs/sourceUrl/category:', items.slice(0,5).map(i=>({id:i.id,slug:i.slug,sourceUrl:i.sourceUrl,category:i.category})));
        setProducts(items);
        setLoading(false);
        setCurrentPage(1);
      },
    });

    return () => {
      // Marca como inativo antes de cancelar a subscription
      active.current = false;
      // DEBUG: log unsubscribe
      console.log('[CategoryPage] unsubscribing from productService for category', category?.name);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [category, sortBy]);

  // Deriva produtos filtrados por subcategoria (mantém o estado original de produtos intacto)
  const filteredProducts = selectedSubcategory
    ? products.filter(p => {
        const productSub = getProductSubcategory(p);
        const selectedNorm = normalizeStr(selectedSubcategory);
        return productSub === selectedNorm;
      })
    : products;
// Reset page when subcategory changes
useEffect(() => {
  setCurrentPage(1);
}, [selectedSubcategory]);

// Paginação baseada nos produtos já filtrados
  // Paginação baseada nos produtos já filtrados
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) || 1;
  const displayedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5; // show up to 5 page numbers
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    // adjust start if we are near the end
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={`px-3 py-1 rounded ${i === currentPage ? 'bg-brand-purple text-white' : 'bg-brand-surface text-slate-300 hover:bg-brand-card hover:text-white'} transition-colors`}
        >
          {i}
        </button>
      );
    }
    if (start > 1) {
      pages.unshift(<span key="start-ellipsis" className="px-2 text-slate-400">…</span>);
    }
    if (end < totalPages) {
      pages.push(<span key="end-ellipsis" className="px-2 text-slate-400">…</span>);
    }
    return pages;
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-brand-muted mb-6">
          <Link to="/" className="hover:text-white transition-colors">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white font-medium">{category?.name || 'Categoria'}</span>
          {selectedSubcategory && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-brand-purpleLight font-bold">{selectedSubcategory}</span>
            </>
          )}
        </nav>

        {/* Título e Controles */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-brand-border/60 mb-8">
          {category?.slug !== 'tabela-de-conversao-br-x-eur' && (
            <div>
              <h1 className="font-display font-black text-3xl sm:text-4xl text-white">
                {category?.name || 'Catálogo'}
              </h1>
              <p className="text-sm text-brand-muted mt-1">
                {products.length} {products.length === 1 ? 'produto publicado' : 'produtos publicados'} nesta categoria
              </p>
            </div>
          )}


          {/* Ordenação */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-brand-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-brand-surface border border-brand-border rounded-xl text-xs font-bold text-white px-3 py-2 focus:outline-none focus:border-brand-purple"
            >
              <option value="newest">Mais Recentes</option>
              <option value="name-asc">Nome A-Z</option>
              <option value="name-desc">Nome Z-A</option>
            </select>
          </div>
        </div>

        {/* Subcategory filter – shown for categories except Camisetas de Time and Camisetas de Time Retrô */}
        {!(category?.slug === 'camisetas-de-time' || category?.slug === 'camisetas-de-time-retro') && category?.subcategories && category.subcategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin">
            <button
              onClick={() => setSelectedSubcategory(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedSubcategory === null
                  ? 'bg-brand-purple text-white shadow-purple-glow'
                  : 'bg-brand-surface text-slate-300 hover:text-white hover:bg-brand-card border border-brand-border'
              }`}
            >
              Todos
            </button>
            {category.subcategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubcategory(sub === selectedSubcategory ? null : sub)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedSubcategory === sub
                    ? 'bg-brand-purple text-white shadow-purple-glow'
                    : 'bg-brand-surface text-slate-300 hover:text-white hover:bg-brand-card border border-brand-border'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {/* Conditionally render conversion info or product grid */}
        {category?.slug === 'tabela-de-conversao-br-x-eur' ? (
          <ConversionInfoPage />
        ) : (
          <>
            {/* Grid de Produtos */}
            <ProductGrid
              products={displayedProducts}
              loading={loading}
              emptyTitle="Nenhum manto publicado nesta categoria ainda"
              emptyMessage="Volte em breve ou fale com nosso atendente pelo WhatsApp para encomendar modelos específicos."
            />

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6 mb-8">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded bg-brand-surface text-slate-300 hover:bg-brand-card hover:text-white disabled:opacity-50 transition-colors"
                >
                  ← Anterior
                </button>
                <div className="flex items-center gap-1">
                  {renderPageNumbers()}
                </div>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded bg-brand-surface text-slate-300 hover:bg-brand-card hover:text-white disabled:opacity-50 transition-colors"
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
