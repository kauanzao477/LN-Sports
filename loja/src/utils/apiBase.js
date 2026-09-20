/**
 * Base única da API para loja pública e painel admin.
 * - Em produção (Cloudflare Pages): mesmo domínio, retorna '' (path relativo).
 * - Em dev com backend separado (Render) ou Express local: usa VITE_API_URL.
 */
export function getApiBase() {
  try {
    const custom = import.meta?.env?.VITE_API_URL;
    if (custom && String(custom).trim()) {
      return String(custom).replace(/\/$/, '');
    }
  } catch {}
  return '';
}

export function apiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function getAuthHeaders(extra = {}) {
  const token = sessionStorage.getItem('ln_sports_admin_token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
