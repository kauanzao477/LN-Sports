/**
 * Serviço de Categorias da LN SPORTS.
 * Consome /api/categories do server.js (Node/Express + PostgreSQL).
 * Fallback para constante OFFICIAL_CATEGORIES quando API indisponível.
 */
import { slugify } from '../utils/slugify';
import { fetchLatestLocalProducts, getProductSubcategory } from './productService';

// ─────────────────────────────────────────────────────────────────────────────
// Categorias oficiais (fonte da verdade visual — mantidas como fallback)
// ─────────────────────────────────────────────────────────────────────────────
export const OFFICIAL_CATEGORIES = [
  {
    id: 'camisetas-de-time-retro',
    name: 'Camisetas de Time Retrô',
    slug: 'camisetas-de-time-retro',
    subcategories: ['Anos 90', 'Anos 80', 'Copas Clássicas'],
    productCount: 0
  },
  {
    id: 'sapatilhas-de-atletismo',
    name: 'Sapatilhas de Atletismo',
    slug: 'sapatilhas-de-atletismo',
    subcategories: ['Pista e Campo', 'Velocidade', 'Salto'],
    productCount: 0
  },
  {
    id: 'chuteiras',
    name: 'Chuteiras',
    slug: 'chuteiras',
    subcategories: [],
    productCount: 0
  },
  {
    id: 'chuteiras-infantil',
    name: 'Chuteiras Infantil',
    slug: 'chuteiras-infantil',
    subcategories: [],
    productCount: 0
  },
  {
    id: 'tabela-de-conversao-br-x-eur',
    name: 'Tabela de Conversão BR x EUR',
    slug: 'tabela-de-conversao-br-x-eur',
    subcategories: ['Tamanhos Calçados', 'Medidas Vestuário'],
    productCount: 0
  },
  {
    id: 'camisetas-de-time',
    name: 'Camisetas de Time',
    slug: 'camisetas-de-time',
    subcategories: ['Brasileiro Série A', 'Clubes Europeus', 'Seleções Nacionais'],
    productCount: 3
  },
  {
    id: 'tenis-de-corrida',
    name: 'Tênis de Corrida',
    slug: 'tenis-de-corrida',
    subcategories: ['Amortecimento', 'Placa de Carbono', 'Treino Diário', 'Competição'],
    productCount: 0
  },
  {
    id: 'tenis-esportivo',
    name: 'Tênis Esportivo',
    slug: 'tenis-esportivo',
    subcategories: ['Academia & Treino', 'Crossfit', 'Multiesportivo'],
    productCount: 0
  },
  {
    id: 'tenis-on-running-e-hoka',
    name: 'Tênis On Running e HOKA',
    slug: 'tenis-on-running-e-hoka',
    subcategories: ['On Running Cloud', 'HOKA Clifton', 'HOKA Bondi'],
    productCount: 0
  },
  {
    id: 'tenis-casuais',
    name: 'Tênis Casuais',
    slug: 'tenis-casuais',
    subcategories: ['Casuais Premium', 'Sneakers Urbanos'],
    productCount: 0
  },
  {
    id: 'tenis-esportivos',
    name: 'Tênis Esportivos',
    slug: 'tenis-esportivos',
    subcategories: ['Treino & Gym', 'Running Performance'],
    productCount: 0
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: normaliza string
// ─────────────────────────────────────────────────────────────────────────────
function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fallback que calcula contagens a partir de produtos.json local
// ─────────────────────────────────────────────────────────────────────────────
// Mapa de aliases: categoria interna (com senha) -> slug público limpo
const CATEGORY_SLUG_ALIASES = {
  'tenis-casuais-senha-hjh001077': 'tenis-casuais',
  'tenis-esportivos-senha-888888': 'tenis-esportivos',
};

async function getCategoriesFromLocalProducts() {
  const countsBySlug = new Map();
  const subsBySlug   = new Map();
  const sourceProducts = await fetchLatestLocalProducts();

  for (const p of (sourceProducts || [])) {
    if (!p?.category) continue;
    let catSlug = slugify(p.category);
    // Remapeia slug interno para slug público
    if (CATEGORY_SLUG_ALIASES[catSlug]) catSlug = CATEGORY_SLUG_ALIASES[catSlug];
    countsBySlug.set(catSlug, (countsBySlug.get(catSlug) || 0) + 1);

    if (p.subcategory?.trim()) {
      const normalized = p.subcategory.trim().toLowerCase();
      if (normalized !== 'todas as categorias') {
        if (!subsBySlug.has(catSlug)) subsBySlug.set(catSlug, new Set());
        subsBySlug.get(catSlug).add(p.subcategory.trim());
      }
    } else {
      const catName = p.category?.trim() || '';
      if (catName === 'Camisetas de Time' || catName === 'Camisetas de Time Retrô') {
        const inferred = getProductSubcategory(p);
        if (inferred) {
          if (!subsBySlug.has(catSlug)) subsBySlug.set(catSlug, new Set());
          subsBySlug.get(catSlug).add(inferred);
        }
      }
    }
  }

  return OFFICIAL_CATEGORIES.map(cat => {
    const realCount   = countsBySlug.get(cat.slug) || 0;
    const dynamicSubs = subsBySlug.has(cat.slug) ? Array.from(subsBySlug.get(cat.slug)) : [];
    return {
      ...cat,
      productCount: realCount,
      subcategories: dynamicSubs.sort((a, b) => a.localeCompare(b)),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage fallbacks (sem Firebase)
// ─────────────────────────────────────────────────────────────────────────────
function getLocalCategories() {
  try {
    const saved = localStorage.getItem('ln_sports_categories');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return OFFICIAL_CATEGORIES;
}

function saveLocalCategories(cats) {
  try {
    localStorage.setItem('ln_sports_categories', JSON.stringify(cats));
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// categoryService
// ─────────────────────────────────────────────────────────────────────────────
export const categoryService = {
  /**
   * Obtém categorias com contagem real de produtos.
   * Fonte primária: GET /api/categories
   * Fallback: cálculo local a partir de produtos.json
   */
  async getCategories() {
    try {
      const token = sessionStorage.getItem('ln_sports_admin_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/categories', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (err) {
      console.warn('[categoryService] API indisponível, usando fallback local:', err.message);
    }
    return getCategoriesFromLocalProducts();
  },

  /**
   * Obtém uma categoria pelo slug.
   * Suporta slugs legados (com senha) remapeados para o slug público limpo.
   */
  async getCategoryBySlug(slug) {
    const categories = await this.getCategories();
    const cleanSlug = slugify(slug);
    // Resolve alias de slug legado para slug público
    const resolved = CATEGORY_SLUG_ALIASES[cleanSlug] || cleanSlug;
    return categories.find(c =>
      c.slug === resolved ||
      c.slug === cleanSlug ||
      c.slug === slug ||
      slugify(c.name) === resolved ||
      slugify(c.name) === cleanSlug
    ) || null;
  },

  /**
   * Cria ou atualiza uma categoria (admin).
   */
  async saveCategory(catData) {
    const cleanSlug = catData.slug || slugify(catData.name);
    const payload = {
      name: catData.name,
      slug: cleanSlug,
      subcategories: Array.isArray(catData.subcategories) ? catData.subcategories : [],
      productCount: Number(catData.productCount) || 0
    };

    try {
      const token = sessionStorage.getItem('ln_sports_admin_token');
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return res.json();
    } catch (err) {
      console.warn('[categoryService] saveCategory API error:', err.message);
    }

    // Fallback local
    const current = getLocalCategories();
    const existingIndex = current.findIndex(c => c.slug === cleanSlug);
    let updated;
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...payload };
    } else {
      updated = [...current, { id: `local-${Date.now()}`, ...payload }];
    }
    saveLocalCategories(updated);
    return payload;
  },
};
