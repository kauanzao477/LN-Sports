import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Eye, Tag } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { getProductWhatsAppUrl } from '../../services/whatsappService';
import { useStore } from '../../context/StoreContext';

export function ProductCard({ product }) {
  const { settings } = useStore();
  if (!product) return null;

  const mainIdx = product.mainImageIndex ?? 0;
  const mainImage = product.images && product.images.length > 0 ? product.images[mainIdx] || product.images[0] : null;
  const whatsappUrl = getProductWhatsAppUrl(product, settings);

  return (
    <div className="group glass-card rounded-2xl p-2 sm:p-3 flex flex-col justify-between transition-all duration-300 hover:translate-y-[-4px] hover:border-brand-purple/40">
      
      {/* Imagem do Produto */}
      <Link to={`/produto/${product.slug}`} className="block relative overflow-hidden rounded-xl">
        <ProductImage
          src={mainImage}
          alt={product.name}
          aspectRatio="aspect-[4/5]"
          className="group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badge de Categoria */}
        {product.category && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-brand-dark/80 backdrop-blur-md text-brand-purpleNeon border border-brand-purple/30">
              <Tag className="w-2.5 h-2.5" />
              <span className="truncate max-w-[120px]">{product.category}</span>
            </span>
          </div>
        )}

        {/* Badge de Destaque */}
        {product.featured && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest bg-brand-purple text-white shadow-md">
              Destaque
            </span>
          </div>
        )}
      </Link>

      {/* Informações do Produto */}
      <div className="mt-3 flex-1 flex flex-col">
        {product.subcategory && (
          <span className="text-[11px] font-semibold text-brand-purpleLight tracking-wide mb-1">
            {product.subcategory}
          </span>
        )}
        
        <Link
          to={`/produto/${product.slug}`}
          className="font-display font-bold text-sm text-white line-clamp-2 hover:text-brand-purpleLight transition-colors leading-snug flex-1"
          title={product.name}
        >
          {product.name}
        </Link>

        {/* Botões de Ação */}
        <div className="mt-2 sm:mt-4 grid grid-cols-2 gap-1.5 sm:gap-2 pt-2 sm:pt-3 border-t border-brand-border/60">
          <Link
            to={`/produto/${product.slug}`}
            className="inline-flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-xl bg-brand-surface hover:bg-brand-card text-slate-300 hover:text-white text-[10px] sm:text-xs font-bold border border-brand-border hover:border-brand-purple/50 transition-colors"
          >
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-purpleLight" />
            <span>Detalhes</span>
          </Link>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1.5 sm:px-2.5 rounded-xl bg-brand-whatsapp text-white hover:bg-brand-whatsappHover text-[10px] sm:text-xs font-extrabold shadow-md shadow-brand-whatsapp/20 transition-all active:scale-95"
            title="Conversar com atendente no WhatsApp"
          >
            <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
            <span className="truncate">Comprar</span>
          </a>
        </div>
      </div>
    </div>
  );
}
