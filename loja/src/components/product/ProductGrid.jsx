import React from 'react';
import { ProductCard } from './ProductCard';
import { SkeletonCard } from './SkeletonCard';
import { Shirt, SearchX } from 'lucide-react';

export function ProductGrid({
  products = [],
  loading = false,
  skeletonCount = 8,
  emptyTitle = 'Nenhum produto encontrado',
  emptyMessage = 'Tente ajustar os filtros ou pesquisar por outro termo.'
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center border border-brand-border flex flex-col items-center justify-center my-8">
        <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-purple/20 flex items-center justify-center text-brand-purpleLight mb-4 shadow-lg">
          <SearchX className="w-8 h-8" />
        </div>
        <h3 className="font-display font-bold text-lg text-white mb-2">{emptyTitle}</h3>
        <p className="text-sm text-brand-muted max-w-md">{emptyMessage}</p>
      </div>
    );
  }

  // ---------- Duplicate‑key detection (temporary) ----------
  const seenKeys = new Set();
  const renderProducts = products.map((product) => {
    // deterministic unique key: sourceUrl + id + slug (fallback to empty strings)
    const uniqueKey = [product.sourceUrl || '', product.id || '', product.slug || ''].join('|');
    if (seenKeys.has(uniqueKey)) {
      console.warn('[ProductGrid] DUPLICATE KEY', uniqueKey);
      console.warn('  existing product', product);
    } else {
      seenKeys.add(uniqueKey);
    }
    return <ProductCard key={uniqueKey} product={product} />;
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
      {renderProducts}
    </div>
  );
}
