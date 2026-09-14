import React, { useState } from 'react';
import { Shirt } from 'lucide-react';
import { getProxiedImageUrl } from '../../utils/imageUtils';

export function ProductImage({
  src,
  alt = 'Produto LN SPORTS',
  className = '',
  aspectRatio = 'aspect-[4/5]',
  loading = 'lazy',
  objectFit = 'object-cover'
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const resolvedSrc = getProxiedImageUrl(src);

  // Fallback se a URL for vazia ou falhar
  if (!resolvedSrc || hasError) {
    return (
      <div
        className={`w-full ${aspectRatio} bg-gradient-to-br from-brand-surface via-brand-card to-brand-surface flex flex-col items-center justify-center p-4 text-center border border-brand-border/60 rounded-xl ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purpleLight mb-2 shadow-inner">
          <Shirt className="w-6 h-6" />
        </div>
        <span className="text-[11px] text-brand-muted font-medium">Foto sob consulta</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectRatio} overflow-hidden rounded-xl bg-brand-surface border border-brand-border/40 ${className}`}>
      {/* Skeleton enquanto carrega */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-brand-card animate-pulse flex items-center justify-center">
          <Shirt className="w-8 h-8 text-brand-purple/20 animate-bounce" />
        </div>
      )}

      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full ${objectFit} transition-all duration-300 ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      />
    </div>
  );
}
