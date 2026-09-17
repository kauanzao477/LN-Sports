/**
 * Utilitário para tratamento de URLs de imagem.
 * O CDN do Yupoo (photo.yupoo.com) bloqueia requisições diretas de navegadores (retornando status 567)
 * devido a proteções de hotlink que exigem o cabeçalho HTTP Referer do catálogo correspondente.
 * Esta função roteia URLs do Yupoo pelo endpoint de proxy /api/image-proxy.
 */
export function getProxiedImageUrl(src) {
  if (!src || typeof src !== 'string') return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  // Always proxy Yupoo images (both dev and prod)
  if (trimmed.includes('photo.yupoo.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
