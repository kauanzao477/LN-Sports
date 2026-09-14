import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Footer } from '../components/common/Footer';
import { ProductGrid } from '../components/product/ProductGrid';
import { productService } from '../services/productService';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function executeSearch() {
      if (!query.trim()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const results = await productService.getProducts({
          status: 'published',
          searchQuery: query,
          limitCount: 50
        });
        setProducts(results);
      } catch (e) {
        console.error("Erro na busca de produtos:", e);
      } finally {
        setLoading(false);
      }
    }
    executeSearch();
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-brand-muted mb-6">
          <Link to="/" className="hover:text-white transition-colors">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white font-medium">Busca</span>
        </nav>

        {/* Cabeçalho da Busca */}
        <div className="pb-6 border-b border-brand-border/60 mb-8">
          <h1 className="font-display font-black text-3xl sm:text-4xl text-white flex items-center gap-3">
            <Search className="w-8 h-8 text-brand-purpleLight" />
            <span>Resultados para: <span className="text-brand-purpleNeon">"{query}"</span></span>
          </h1>
          <p className="text-sm text-brand-muted mt-2">
            {products.length} {products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </p>
        </div>

        {/* Grid de Resultados */}
        <ProductGrid
          products={products}
          loading={loading}
          emptyTitle={`Nenhum resultado para "${query}"`}
          emptyMessage="Tente buscar por outro time, país, jogador ou categoria."
        />
      </main>

      <Footer />
    </div>
  );
}
