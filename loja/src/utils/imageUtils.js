/**
 * Utilitário para tratamento de URLs de imagem.
 *
 * Regra Cloudflare Pages:
 * 1. Tentar URL direta do Yupoo primeiro.
 * 2. Se a URL direta falhar, usar proxy como fallback.
 * 3. Render não deve ser usado como proxy principal.
 */

export function getDirectImageUrl(src) {
  if (!src || typeof src !== 'string') return null;
  return src.trim();
}

export function getProxiedImageUrl(src) {
  if (!src || typeof src !== 'string') return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  // Fallback de proxy para imagens Yupoo
  if (trimmed.includes('photo.yupoo.com')) {
    const proxyBase = import.meta.env.VITE_IMAGE_PROXY_URL || '/api/image-proxy';
    return `${proxyBase}?url=${encodeURIComponent(trimmed)}&v=2`;
  }

  return trimmed;
}

