import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { ProductImage } from './ProductImage';

export function ProductGallery({
  images = [],
  productName = 'Produto LN SPORTS',
  mainImageIndex = 0,
  onSetMainImage = null,
}) {
  const [selectedIndex, setSelectedIndex] = useState(mainImageIndex);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sincroniza quando mainImageIndex muda externamente
  useEffect(() => {
    setSelectedIndex(mainImageIndex);
  }, [mainImageIndex]);

  // Lista limpa de imagens válidas
  const validImages = Array.isArray(images) && images.length > 0
    ? images
    : [];

  const currentImage = validImages[selectedIndex] || null;

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : validImages.length - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev < validImages.length - 1 ? prev + 1 : 0));
  };

  const handleSetMain = (index) => {
    if (onSetMainImage) {
      onSetMainImage(index);
      setSelectedIndex(index);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Imagem Principal em Alta Resolução */}
      <div className="relative group overflow-hidden rounded-2xl glass-card border border-brand-border">
        <ProductImage
          src={currentImage}
          alt={`${productName} - Foto ${selectedIndex + 1}`}
          aspectRatio="aspect-[4/5] sm:aspect-square"
          className="w-full h-full object-contain bg-black/40"
          loading="eager"
        />

        {/* Controles de Navegação (Se houver mais de 1 foto) */}
        {validImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-brand-dark/70 text-white backdrop-blur-md border border-brand-border hover:bg-brand-purple transition-all opacity-80 group-hover:opacity-100"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-brand-dark/70 text-white backdrop-blur-md border border-brand-border hover:bg-brand-purple transition-all opacity-80 group-hover:opacity-100"
              aria-label="Próxima foto"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Contador de Fotos */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-brand-dark/80 backdrop-blur-md border border-brand-border text-[11px] font-bold text-white">
              {selectedIndex + 1} / {validImages.length}
            </div>
          </>
        )}

        {/* Indicador de foto principal (admin) */}
        {onSetMainImage && selectedIndex === mainImageIndex && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-purple/90 backdrop-blur-md text-[10px] font-bold text-white border border-brand-purpleLight/40">
            <Star className="w-3 h-3 fill-current" />
            <span>Foto Principal</span>
          </div>
        )}

        {/* Feedback de salvo */}
        {savedFeedback && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-green-500/90 backdrop-blur-md text-[11px] font-bold text-white animate-bounce">
            ✓ Foto principal salva!
          </div>
        )}
      </div>

      {/* Carrossel de Miniaturas */}
      {validImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {validImages.map((imgUrl, index) => {
            const isSelected = selectedIndex === index;
            const isMain = index === mainImageIndex;

            return (
              <div key={index} className="relative shrink-0 group/thumb">
                <button
                  onClick={() => setSelectedIndex(index)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-brand-purpleLight shadow-lg shadow-brand-purple/40 scale-105'
                      : 'border-brand-border/60 opacity-60 hover:opacity-100 hover:border-brand-border'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`Miniatura ${index + 1}`}
                    aspectRatio="aspect-square"
                    className="w-full h-full object-cover"
                  />

                  {/* Indicador de foto principal nas miniaturas */}
                  {isMain && (
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand-purple flex items-center justify-center">
                      <Star className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                  )}
                </button>

                {/* Botão admin: definir como capa */}
                {onSetMainImage && !isMain && (
                  <button
                    onClick={() => handleSetMain(index)}
                    className="absolute inset-0 rounded-xl flex items-end justify-center pb-1 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-150 cursor-pointer"
                    title="Definir como foto principal"
                  >
                    <span className="text-[9px] text-white font-extrabold bg-brand-purple px-1.5 py-0.5 rounded-full leading-tight">
                      ⭐ Capa
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dica admin */}
      {onSetMainImage && validImages.length > 1 && (
        <p className="text-[10px] text-brand-muted text-center">
          Passe o mouse sobre uma miniatura e clique em <strong className="text-brand-purpleLight">⭐ Capa</strong> para definir a foto principal
        </p>
      )}
    </div>
  );
}

