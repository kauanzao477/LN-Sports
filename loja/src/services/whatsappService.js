/**
 * Serviço Centralizado de Atendimento WhatsApp.
 * Toda a geração de links do WhatsApp deve passar por este serviço.
 * O número e templates são centralizados nas configurações da loja.
 */

// Fallback padrão: número oficial LN-Sports (+55 49 99804-6866)
const DEFAULT_NUMBER = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '5549998046866';
const DEFAULT_STORE_NAME = import.meta.env.VITE_STORE_NAME || 'LN-Sports Outlet';

/**
 * Limpa o número de telefone mantendo apenas dígitos no formato internacional (55...).
 */
export function sanitizeWhatsAppNumber(num) {
  if (!num) return DEFAULT_NUMBER;
  const digits = num.toString().replace(/\D/g, '');
  // Garante DDI 55 (Brasil) caso o usuário tenha inserido apenas DDD + número
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits || DEFAULT_NUMBER;
}

/**
 * Gera o link do WhatsApp para um produto específico com mensagem pré-formatada inteligente.
 * @param {Object} product - Produto selecionado
 * @param {Object|string} options - Configurações da loja ou objeto com { size, settings }
 */
export function getProductWhatsAppUrl(product, options = {}) {
  const settings = options?.settings || (options?.whatsappNumber ? options : {});
  const number = sanitizeWhatsAppNumber(settings?.whatsappNumber || DEFAULT_NUMBER);

  if (!product) {
    return `https://wa.me/${number}?text=${encodeURIComponent('Olá! Gostaria de mais informações.')}`;
  }

  const productName = product.name || 'Produto LN SPORTS';
  const size = options?.size || options?.selectedSize || product?.selectedSize || null;

  let message = '';
  if (size) {
    message = `Olá! Tenho interesse no produto: ${productName}. Tamanho: ${size}. Gostaria de mais informações.`;
  } else {
    message = `Olá! Tenho interesse no produto: ${productName}. Gostaria de mais informações.`;
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Gera o link geral de atendimento ("Falar com Atendente").
 */
export function getGeneralWhatsAppUrl(settings = {}) {
  const number = sanitizeWhatsAppNumber(settings.whatsappNumber || DEFAULT_NUMBER);
  const message = 'Olá! Gostaria de falar com o atendimento da LN-Sports.';
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
