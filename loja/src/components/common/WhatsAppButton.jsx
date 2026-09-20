import React from 'react';
import { MessageCircle } from 'lucide-react';
import { getGeneralWhatsAppUrl } from '../../services/whatsappService';
import { useStore } from '../../context/StoreContext';

export function WhatsAppButton({
  url = null,
  text = 'Falar com Atendente',
  className = '',
  size = 'md',
  showIcon = true
}) {
  const { settings } = useStore();
  const targetUrl = url || getGeneralWhatsAppUrl(settings);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2.5 text-sm font-bold',
    lg: 'px-6 py-3.5 text-base font-extrabold'
  };

  return (
    <a
      href={targetUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-whatsapp text-white hover:bg-brand-whatsappHover transition-all duration-200 shadow-lg shadow-brand-whatsapp/20 hover:shadow-brand-whatsapp/40 active:scale-95 ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <MessageCircle className="w-5 h-5 fill-current shrink-0" />}
      <span>{text}</span>
    </a>
  );
}
