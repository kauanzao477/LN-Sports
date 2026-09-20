import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BANNERS = [
  '/carrosel/BANNER-ROTATIVO-1-LN.jpg',
  '/carrosel/BANNER-ROTATIVO-3-LN.jpg',
];

const AUTOPLAY_MS = 5000;

export function BannerCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = BANNERS.length;

  const goTo = useCallback((index) => {
    setActive(((index % total) + total) % total);
  }, [total]);

  const handlePrev = () => goTo(active - 1);
  const handleNext = () => goTo(active + 1);

  // Rotação automática (pausa no hover/toque)
  useEffect(() => {
    if (paused || total <= 1) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % total);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, total]);

  if (total === 0) return null;

  return (
    <section
      aria-label="Banners em destaque"
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-brand-border/60 shadow-card group">
        {/* Slides */}
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {BANNERS.map((src, index) => (
            <div key={src} className="w-full shrink-0">
              <img
                src={src}
                alt={`Banner LN SPORTS ${index + 1}`}
                className="w-full h-auto object-cover"
                loading={index === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Setas (só se houver +1 banner) */}
        {total > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Banner anterior"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-dark/70 text-white backdrop-blur-md border border-brand-border hover:bg-brand-purple transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Próximo banner"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-brand-dark/70 text-white backdrop-blur-md border border-brand-border hover:bg-brand-purple transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Indicadores */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
              {BANNERS.map((src, index) => (
                <button
                  key={src}
                  onClick={() => goTo(index)}
                  aria-label={`Ir para banner ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === active
                      ? 'w-6 bg-brand-purpleLight shadow-purple-glow'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
