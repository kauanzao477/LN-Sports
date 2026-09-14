/**
 * Serviço de Categorias e Subcategorias da LN SPORTS.
 * Gerencia a hierarquia de categorias mapeadas pelo scraper e sincronizadas no Firestore.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { slugify } from '../utils/slugify';

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
    id: 'tenis-casuais-senha-hjh001077',
    name: 'Tênis Casuais - Senha: HJH001077',
    slug: 'tenis-casuais-senha-hjh001077',
    subcategories: ['Casuais Premium', 'Sneakers Urbanos'],
    productCount: 0
  },
  {
    id: 'tenis-esportivos-senha-888888',
    name: 'Tênis Esportivos - Senha: 888888',
    slug: 'tenis-esportivos-senha-888888',
    subcategories: ['Treino & Gym', 'Running Performance'],
    productCount: 0
  }
];

const INITIAL_DEMO_CATEGORIES = OFFICIAL_CATEGORIES;

function getLocalCategories() {
  try {
    const saved = localStorage.getItem('ln_sports_categories');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return INITIAL_DEMO_CATEGORIES;
}

function saveLocalCategories(cats) {
  try {
    localStorage.setItem('ln_sports_categories', JSON.stringify(cats));
  } catch (e) {}
}

import { fetchLatestLocalProducts, getProductSubcategory } from './productService';

function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export const categoryService = {
  /**
   * Obtém a lista de todas as categorias cadastradas.
   * Calcula a contagem real de produtos e subcategorias dinamicamente a partir de produtos.json.
   */
  async getCategories() {
    // Agrupa contagem e subcategorias diretamente de produtos.json
    const countsBySlug = new Map();
    const subsBySlug = new Map();
    const sourceProducts = await fetchLatestLocalProducts();

    for (const p of (sourceProducts || [])) {
      if (!p || !p.category) continue;
      const catSlug = slugify(p.category);
      countsBySlug.set(catSlug, (countsBySlug.get(catSlug) || 0) + 1);

      if (p.subcategory && p.subcategory.trim()) {
        // Exclude placeholder values such as "Todas as categorias"
        const normalized = p.subcategory.trim().toLowerCase();
        if (normalized !== 'todas as categorias') {
          if (!subsBySlug.has(catSlug)) subsBySlug.set(catSlug, new Set());
          subsBySlug.get(catSlug).add(p.subcategory.trim());
        }
         } else {
        // Infer team for Camisetas de Time categories when subcategory missing
        const catName = p.category ? p.category.trim() : '';
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
      const realCount = countsBySlug.get(cat.slug) || 0;
      const dynamicSubs = subsBySlug.has(cat.slug) ? Array.from(subsBySlug.get(cat.slug)) : [];
      // Sort subcategories alphabetically for UI consistency
      const sortedSubs = dynamicSubs.sort((a, b) => a.localeCompare(b));
      return {
        ...cat,
        productCount: realCount,
        subcategories: sortedSubs
      };
    });
  },

  /**
   * Obtém uma categoria pelo slug.
   */
  async getCategoryBySlug(slug) {
    const categories = await this.getCategories();
    const cleanSlug = slugify(slug);
    return categories.find(c => c.slug === cleanSlug || c.slug === slug || slugify(c.name) === cleanSlug) || null;
  },

  /**
   * Cria ou atualiza uma categoria.
   */
  async saveCategory(catData) {
    const cleanSlug = catData.slug || slugify(catData.name);
    const payload = {
      name: catData.name,
      slug: cleanSlug,
      subcategories: Array.isArray(catData.subcategories) ? catData.subcategories : [],
      productCount: Number(catData.productCount) || 0
    };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'categories', cleanSlug);
        await setDoc(docRef, payload, { merge: true });
        return { id: cleanSlug, ...payload };
      } catch (error) {
        console.error("[categoryService] Erro ao gravar categoria no Firestore:", error);
      }
    }

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
  }
};
