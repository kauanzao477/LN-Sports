/**
 * Serviço Centralizado de Atendimento WhatsApp.
 * Toda a geração de links do WhatsApp deve passar por este serviço.
 * O número e templates são centralizados nas configurações da loja.
 */

// Fallback padrão se não houver configuração no banco ou .env
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
 * Gera o link do WhatsApp para um produto específico com mensagem pré-formatada.
 */
export function getProductWhatsAppUrl(product, settings = {}) {
  const number = sanitizeWhatsAppNumber(settings.whatsappNumber || DEFAULT_NUMBER);
  const storeName = settings.storeName || DEFAULT_STORE_NAME;
  
  // Constrói a URL canônica do produto
  const productUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/produto/${product.slug}`
    : `https://lnsports.com.br/produto/${product.slug}`;

  // Template da mensagem oficial
  const message = [
    `Olá, ${storeName}! Tenho interesse neste produto:`,
    `👕 *Produto:* ${product.name}`,
    product.category ? `📁 *Categoria:* ${product.category}` : null,
    product.subcategory ? `🏷️ *Subcategoria:* ${product.subcategory}` : null,
    `🔗 *Link:* ${productUrl}`,
    '',
    'Gostaria de saber a disponibilidade e mais informações com um atendente!'
  ].filter(Boolean).join('\n');

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Gera o link geral de atendimento ("Falar com Atendente").
 */
export function getGeneralWhatsAppUrl(settings = {}) {
  const number = sanitizeWhatsAppNumber(settings.whatsappNumber || DEFAULT_NUMBER);
  const storeName = settings.storeName || DEFAULT_STORE_NAME;

  const message = `Olá! Gostaria de falar com um atendente da ${storeName}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
