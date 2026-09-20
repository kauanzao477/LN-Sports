/**
 * Utilitário para tratamento de URLs de imagem.
 *
 * Regra Cloudflare Pages:
 * 1. Tentar URL direta do Yupoo primeiro.
 * 2. Se a URL direta falhar (incluindo placeholder detectado pelo proxy), usar proxy como fallback.
 * 3. Render não deve ser usado como proxy principal.
 */

export function getDirectImageUrl(src) {
  if (!src || typeof src !== 'string') return null;
  return src.trim();
}

/** Retorna true para qualquer domínio de imagem do Yupoo. */
export function isYupooUrl(src) {
  if (!src || typeof src !== 'string') return false;
  return src.includes('photo.yupoo.com') || src.includes('uvd.yupoo.com');
}

export function getProxiedImageUrl(src) {
  if (!src || typeof src !== 'string') return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  // Fallback de proxy para qualquer CDN do Yupoo
  if (isYupooUrl(trimmed)) {
    const proxyBase = import.meta.env.VITE_IMAGE_PROXY_URL || '/api/image-proxy';
    return `${proxyBase}?url=${encodeURIComponent(trimmed)}&v=2`;
  }

  return trimmed;
}
