import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ArrowUpDown } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ProductGrid } from '../components/product/ProductGrid';
import { ConversionInfoPage } from './ConversionInfoPage';
import { productService, PRODUCTS_PER_PAGE } from '../services/productService';
import { categoryService } from '../services/categoryService';

export function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Carrega informações da categoria
  useEffect(() => {
    async function loadCat() {
      const found = await categoryService.getCategoryBySlug(slug);
      setCategory(found || { name: slug.replace(/-/g, ' ').toUpperCase(), slug });
    }
    loadCat();
    // Ao trocar de categoria, reseta página
    setCurrentPage(1);
  }, [slug]);

  // Carrega produtos da página atual via API (server-side pagination)
  useEffect(() => {
    if (!category) return;
    // Não carrega produtos para a página de conversão
    if (category?.slug === 'tabela-de-conversao-br-x-eur') return;

    let cancelled = false;
    setLoading(true);

    async function loadPage() {
      try {
        const result = await productService.getProducts({
          status: 'all',
          category: category.name,
          sortBy,
          page: currentPage,
          limitCount: PRODUCTS_PER_PAGE,
        });

        if (cancelled) return;

        const items = result?.data || [];
        setProducts(items);
        setTotalPages(result?.totalPages || 1);
        setTotalCount(result?.total || items.length);
        setLoading(false);

        console.log(
          `[CategoryPage] page=${result?.page}/${result?.totalPages} total=${result?.total} items=${items.length}`,
        );
      } catch (err) {
        if (!cancelled) {
          console.error('[CategoryPage] getProducts error:', err.message);
          setLoading(false);
        }
      }
    }

    loadPage();
    return () => { cancelled = true; };
  }, [category, sortBy, currentPage]);

  // Reset page when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-brand-muted mb-3 lg:mb-6">
          <Link to="/" className="hover:text-white transition-colors">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white font-medium">{category?.name || 'Categoria'}</span>
        </nav>

        {/* Título e Controles */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 pb-4 border-b border-brand-border/60 mb-4 lg:pb-6 lg:mb-8">
          {category?.slug !== 'tabela-de-conversao-br-x-eur' && (
            <div>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-white">
                {category?.name || 'Catálogo'}
              </h1>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                {totalCount} {totalCount === 1 ? 'produto publicado' : 'produtos publicados'}
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

        {/* Conditionally render conversion info or product grid */}
        {category?.slug === 'tabela-de-conversao-br-x-eur' ? (
          <ConversionInfoPage />
        ) : (
          <>
            {/* Grid de Produtos */}
            <ProductGrid
              products={products}
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
