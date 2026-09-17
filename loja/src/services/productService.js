/**
 * Serviço de Produtos da LN SPORTS.
 * Consome a API REST do server.js (Node/Express + PostgreSQL).
 * O React nunca acessa o banco diretamente.
 *
 * Fallback: usa produtos.json / INITIAL_DEMO_PRODUCTS quando a API não está disponível.
 */
import { slugify } from '../utils/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// Demo products (fallback quando API e JSON não disponíveis)
// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_DEMO_PRODUCTS = [
  {
    id: 'demo-1',
    name: 'Spain 2026 2 Stars Special Edition Jersey - Blue S-4XL',
    slug: 'spain-2026-2-stars-special-edition-jersey-blue-s-4xl',
    category: 'Seleções',
    subcategory: 'Espanha',
    images: [
      'https://photo.yupoo.com/minkang/fe887e57fa/0755eab0.png',
      'https://photo.yupoo.com/minkang/c67a4e4efa/f6cdf875.png'
    ],
    sourceUrl: 'https://minkang.x.yupoo.com/albums/248186871?uid=1',
    sourceProvider: 'yupoo',
    description: 'Camisa Edição Especial Espanha 2026 2-Star na cor azul.',
    published: true, featured: true, status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-2',
    name: 'Spain 2026 Special Edition 2-Star - Red Jersey S-4XL',
    slug: 'spain-2026-special-edition-2-star-red-jersey-s-4xl',
    category: 'Seleções',
    subcategory: 'Espanha',
    images: [
      'https://photo.yupoo.com/minkang/f7b1b4cbe1/c753afc3.jpg',
      'https://photo.yupoo.com/minkang/5b414c0a98/2b5bcc8d.jpg'
    ],
    sourceUrl: 'https://minkang.x.yupoo.com/albums/247790784?uid=1',
    sourceProvider: 'yupoo',
    description: 'Manto Oficial Espanha 2026 Vermelha com duas estrelas bordadas.',
    published: true, featured: true, status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Mapa de aliases internos -> nome público (sem expor senha)
const CATEGORY_ALIASES = {
  'Tênis Casuais - Senha: HJH001077': 'Tênis Casuais',
  'Tênis Esportivos - Senha: 888888':  'Tênis Esportivos',
};

// Inferir categoria a partir do sourceUrl (preserva lógica original)
export function inferCategory(product) {
  const url = product.sourceUrl || '';
  if (url.includes('lvguccinike.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('ywq2000.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('mzrycm102618.x.yupoo.com') && url.includes('/4742786')) return 'Chuteiras Infantil';
  if (product.category === 'Catálogo de Chuteiras - 01' ||
      product.category === 'Catálogo de Chuteiras - 02' ||
      product.category === 'Catálogo de Chuteiras - 03') return 'Chuteiras';
  if (product.category === 'Catálogo de Chuteiras - Infantil') return 'Chuteiras Infantil';
  // Mapeia categorias internas (com senha) para nomes públicos
  if (CATEGORY_ALIASES[product.category]) return CATEGORY_ALIASES[product.category];
  return product.category;
}

// Time inference utilities (preservadas do original)
const PREDEFINED_TEAMS = [
  'Flamengo', 'Internacional', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
  'Grêmio', 'Cruzeiro', 'Atlético-MG', 'Vasco', 'Botafogo', 'Fluminense',
  'Bahia', 'Fortaleza', 'Ceará', 'Sport', 'Vitória', 'Athletico-PR', 'Coritiba'
];

const TEAM_ALIASES = {
  'inter': 'Internacional',
  'atletico mg': 'Atlético-MG',
  'atletico-mg': 'Atlético-MG',
  'athletico pr': 'Athletico-PR',
  'athletico-pr': 'Athletico-PR',
};

let knownTeamsCache = null;
function getKnownTeams(allProducts = []) {
  if (knownTeamsCache) return knownTeamsCache;
  knownTeamsCache = new Set();
  for (const p of allProducts) {
    if (p?.subcategory?.trim()) knownTeamsCache.add(normalizeStr(p.subcategory));
  }
  for (const team of PREDEFINED_TEAMS) knownTeamsCache.add(normalizeStr(team));
  for (const alias of Object.keys(TEAM_ALIASES)) knownTeamsCache.add(normalizeStr(alias));
  return knownTeamsCache;
}

function inferTeamFromName(name, allProducts = []) {
  const nameNorm = normalizeStr(name);
  const teams = getKnownTeams(allProducts);
  let bestMatch = '';
  for (const teamNorm of teams) {
    if (nameNorm.includes(teamNorm) && teamNorm.length > bestMatch.length) {
      bestMatch = teamNorm;
    }
  }
  if (!bestMatch) return '';
  const aliasKey = Object.keys(TEAM_ALIASES).find(k => normalizeStr(k) === bestMatch);
  if (aliasKey) return TEAM_ALIASES[aliasKey];
  const canonical = PREDEFINED_TEAMS.find(t => normalizeStr(t) === bestMatch);
  if (canonical) return canonical;
  return bestMatch;
}

export function getProductSubcategory(product, allProducts = []) {
  if (!product) return '';
  if (product.subcategory?.trim()) return normalizeStr(product.subcategory);
  const cat = product.category?.trim() || '';
  if (cat === 'Camisetas de Time' || cat === 'Camisetas de Time Retrô') {
    return inferTeamFromName(product.name || '', allProducts);
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Determina base URL da API (relativo no prod, absoluto em dev se necessário)
// ─────────────────────────────────────────────────────────────────────────────
function apiUrl(path) {
  return path;  // relativo — funciona tanto em dev (proxy Vite) quanto em prod
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache local (fallback do produtos.json — mantido para compatibilidade)
// ─────────────────────────────────────────────────────────────────────────────
let liveProductsCache = INITIAL_DEMO_PRODUCTS;
let lastFetchTimestamp = 0;

let cachedMergedProducts = null;
let lastSourceListRef = null;

export async function fetchLatestLocalProducts() {
  // Se já temos produtos carregados na memória, não refaz o download pesado de 62MB
  if (liveProductsCache && liveProductsCache.length > 10) {
    return liveProductsCache;
  }

  const now = Date.now();
  if (now - lastFetchTimestamp > 60000) {
    lastFetchTimestamp = now;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/produtos.json`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          liveProductsCache = data;
          cachedMergedProducts = null; // invalida cache para reprocessar
        }
      }
    } catch (e) { /* silencioso */ }
  }
  return liveProductsCache;
}

function getLocalProducts() {
  const sourceList = liveProductsCache?.length > 0 ? liveProductsCache : INITIAL_DEMO_PRODUCTS;

  if (cachedMergedProducts && lastSourceListRef === sourceList) {
    return cachedMergedProducts;
  }

  let adminEdits = {};
  try {
    const saved = localStorage.getItem('ln_sports_admin_edits');
    if (saved) adminEdits = JSON.parse(saved);
  } catch (e) {}

  const merged = [];
  const seenUrls = new Set();

  for (let i = 0; i < sourceList.length; i++) {
    const imp = sourceList[i];
    if (!imp?.sourceUrl) continue;
    if (seenUrls.has(imp.sourceUrl)) continue;
    seenUrls.add(imp.sourceUrl);

    const override = adminEdits[imp.sourceUrl] || adminEdits[imp.slug] || {};
    const product = {
      id: imp.slug || imp.id || String(i),
      ...imp,
      ...override,
      published: imp.published !== false,
      status: imp.status || 'published'
    };
    product.category = inferCategory(product);
    merged.push(product);
  }

  lastSourceListRef = sourceList;
  cachedMergedProducts = merged;
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = sessionStorage.getItem('ln_sports_admin_token');
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
export const PRODUCTS_PER_PAGE = 24;

// ─────────────────────────────────────────────────────────────────────────────
// productService
// ─────────────────────────────────────────────────────────────────────────────
export const productService = {

  /**
   * Busca produtos com filtros e paginação via API PostgreSQL.
   * Fallback para local (produtos.json) se API indisponível.
   */
  async getProducts({
    status = 'all',
    category = null,
    subcategory = null,
    featured = null,
    limitCount = PRODUCTS_PER_PAGE,
    searchQuery = '',
    sortBy = 'newest',
    page = 1,
  } = {}) {
    // Tenta a API primeiro
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limitCount);
      if (status && status !== 'all') params.set('status', status);
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      if (featured !== null) params.set('featured', featured);
      if (searchQuery) params.set('search', searchQuery);
      if (sortBy) params.set('sort', sortBy === 'newest' ? 'newest' : sortBy);

      const result = await apiFetch(`/api/products?${params.toString()}`);
      // Aplica inferCategory em cada produto retornado
      if (result?.data) {
        result.data = result.data.map(p => ({ ...p, category: inferCategory(p) }));
      }
      return result; // { data, total, page, totalPages, limit }
    } catch (err) {
      console.warn('[productService] API indisponível, usando fallback local:', err.message);
    }

    // Fallback local
    await fetchLatestLocalProducts();
    let items = [...getLocalProducts()];

    if (status && status !== 'all') items = items.filter(p => p.status === status);
    if (category) {
      const catNorm = normalizeStr(category);
      const catSlug = slugify(category);
      items = items.filter(p => {
        if (!p.category) return false;
        // Verifica correspondência direta
        if (normalizeStr(p.category) === catNorm || slugify(p.category) === catSlug) return true;
        // Verifica via alias (ex: 'Tênis Casuais - Senha: HJH001077' -> 'Tênis Casuais')
        const mapped = CATEGORY_ALIASES[p.category];
        if (mapped && (normalizeStr(mapped) === catNorm || slugify(mapped) === catSlug)) return true;
        return false;
      });
    }
    if (subcategory) {
      const subNorm = normalizeStr(subcategory);
      const subSlug = slugify(subcategory);
      items = items.filter(p => p.subcategory && (normalizeStr(p.subcategory) === subNorm || slugify(p.subcategory) === subSlug));
    }
    if (featured !== null) items = items.filter(p => p.featured === featured);
    if (searchQuery) {
      const q = normalizeStr(searchQuery);
      items = items.filter(p =>
        normalizeStr(p.name).includes(q) ||
        normalizeStr(p.category).includes(q) ||
        normalizeStr(p.subcategory).includes(q)
      );
    }

    if (sortBy === 'name-asc')  items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name-desc') items.sort((a, b) => b.name.localeCompare(a.name));
    else items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const offset = (page - 1) * limitCount;
    const sliced = items.slice(offset, offset + limitCount);
    return {
      data: sliced,
      total: items.length,
      page,
      totalPages: Math.ceil(items.length / limitCount),
      limit: limitCount,
    };
  },

  /**
   * Escuta atualizações de produtos via polling da API.
   * Compatível com o contrato anterior (subscribeProducts).
   */
  subscribeProducts({ status = 'all', category = null, limitCount = PRODUCTS_PER_PAGE, callback }) {
    let cancelled = false;
    let lastFingerprint = '';

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await this.getProducts({ status, category, limitCount, page: 1 });
        const items = result?.data || result || [];
        const fingerprint = `${items.length}-${items.map(p => p.slug || p.sourceUrl).join('|')}`;
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          if (!cancelled) callback(items);
        }
      } catch (e) {
        // silencioso
      }
    };

    poll();
    const interval = setInterval(poll, 5000); // polling a cada 5s (API, não 1.5s)
    return () => { cancelled = true; clearInterval(interval); };
  },

  /**
   * Obtém um produto pelo slug.
   */
  async getProductBySlug(slug) {
    try {
      const product = await apiFetch(`/api/products/${slug}`);
      if (product) return { ...product, category: inferCategory(product) };
    } catch (err) {
      console.warn('[productService] Fallback local para slug:', err.message);
    }
    await fetchLatestLocalProducts();
    const found = getLocalProducts().find(p => p.slug === slug);
    return found || null;
  },

  /**
   * Obtém produtos relacionados na mesma categoria.
   */
  async getRelatedProducts(currentProduct, limitCount = 4) {
    if (!currentProduct) return [];
    try {
      const data = await apiFetch(`/api/products/${currentProduct.slug}/related?limit=${limitCount}`);
      return Array.isArray(data) ? data.map(p => ({ ...p, category: inferCategory(p) })) : [];
    } catch {
      // Fallback local
      const all = await this.getProducts({ status: 'published', category: currentProduct.category, limitCount: limitCount + 1, page: 1 });
      const items = all?.data || [];
      return items.filter(p => p.slug !== currentProduct.slug).slice(0, limitCount);
    }
  },

  /**
   * Cria ou atualiza um produto (admin).
   */
  async saveProduct(productData) {
    const cleanSlug = productData.slug || slugify(productData.name);
    const payload = {
      name: productData.name,
      slug: cleanSlug,
      category: productData.category || 'Geral',
      subcategory: productData.subcategory || '',
      images: productData.images || [],
      sourceUrl: productData.sourceUrl || '',
      description: productData.description || '',
      status: productData.status || 'draft',
      featured: Boolean(productData.featured),
      mainImageIndex: productData.mainImageIndex || 0,
    };

    if (productData.id && !productData.id.startsWith('demo-')) {
      return apiFetch(`/api/admin/products/${productData.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }

    // Fallback local para modo sem banco
    const current = getLocalProducts();
    const newProduct = { id: `local-${Date.now()}`, ...payload };
    liveProductsCache = [newProduct, ...current];
    return newProduct;
  },

  /**
   * Toggle publish (admin).
   */
  async togglePublish(productId) {
    try {
      return await apiFetch(`/api/admin/products/${productId}/publish`, { method: 'PATCH' });
    } catch (err) {
      console.error('[productService] togglePublish error:', err.message);
      throw err;
    }
  },

  /**
   * Toggle featured (admin).
   */
  async toggleFeatured(productId) {
    try {
      return await apiFetch(`/api/admin/products/${productId}/featured`, { method: 'PATCH' });
    } catch (err) {
      console.error('[productService] toggleFeatured error:', err.message);
      throw err;
    }
  },

  /**
   * Define manualmente uma imagem existente como capa do produto (images[0]).
   * A imagem escolhida passa para images[0], todas as outras permanecem e a ordem é persistida.
   */
  async setProductCover(product, selectedIndex) {
    if (!product || !Array.isArray(product.images) || selectedIndex < 0 || selectedIndex >= product.images.length) {
      return product;
    }

    const chosenImage = product.images[selectedIndex];
    const otherImages = product.images.filter((_, idx) => idx !== selectedIndex);
    const newImages = [chosenImage, ...otherImages];

    // Persiste no localStorage para manter a seleção após recarregar a página
    let adminEdits = {};
    try {
      const saved = localStorage.getItem('ln_sports_admin_edits');
      if (saved) adminEdits = JSON.parse(saved);
    } catch (e) {}

    const key = product.sourceUrl || product.slug;
    adminEdits[key] = {
      ...(adminEdits[key] || {}),
      images: newImages,
      mainImageIndex: 0
    };
    localStorage.setItem('ln_sports_admin_edits', JSON.stringify(adminEdits));

    // Atualiza imediatamente no cache em memória
    if (Array.isArray(liveProductsCache)) {
      const found = liveProductsCache.find(p => (p.sourceUrl && p.sourceUrl === product.sourceUrl) || (p.slug && p.slug === product.slug));
      if (found) {
        found.images = newImages;
        found.mainImageIndex = 0;
      }
    }

    // Se produto possuir ID cadastrado no backend, sincroniza via API
    if (product.id) {
      try {
        await apiFetch(`/api/admin/products/${product.id}/cover`, {
          method: 'PATCH',
          body: JSON.stringify({ images: newImages, coverIndex: selectedIndex })
        });
      } catch (err) {
        // Fallback local já gravado com sucesso
      }
    }

    return { ...product, images: newImages, mainImageIndex: 0 };
  },

  /**
   * Salva índice da imagem principal (admin).
   */
  async saveMainImageIndex(productSourceUrl, productSlug, index) {
    // Guarda no localStorage para UI imediata
    let adminEdits = {};
    try {
      const saved = localStorage.getItem('ln_sports_admin_edits');
      if (saved) adminEdits = JSON.parse(saved);
    } catch (e) {}
    const key = productSourceUrl || productSlug;
    adminEdits[key] = { ...(adminEdits[key] || {}), mainImageIndex: index };
    localStorage.setItem('ln_sports_admin_edits', JSON.stringify(adminEdits));

    return index;
  },

  /**
   * Remove um produto (admin).
   */
  async deleteProduct(productId) {
    try {
      await apiFetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      return true;
    } catch (err) {
      console.error('[productService] deleteProduct error:', err.message);
      return false;
    }
  },

  /**
   * Métricas do painel administrativo.
   */
  async getDashboardMetrics() {
    try {
      return await apiFetch('/api/admin/dashboard');
    } catch {
      // Fallback calculado localmente
      const result = await this.getProducts({ status: 'all', limitCount: 100, page: 1 });
      const all = result?.data || [];
      const categoriesSet = new Set(all.map(p => p.category).filter(Boolean));
      return {
        total: result?.total || all.length,
        published: all.filter(p => p.status === 'published').length,
        draft: all.filter(p => p.status === 'draft').length,
        inactive: all.filter(p => p.status === 'inactive').length,
        featured: all.filter(p => p.featured).length,
        categoriesCount: categoriesSet.size,
        withoutImages: all.filter(p => !p.images?.length).length,
        withoutDescription: all.filter(p => !p.description).length,
      };
    }
  },
};
