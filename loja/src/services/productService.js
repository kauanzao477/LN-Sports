/**
 * Serviço de Produtos da LN SPORTS.
 * Gerencia consultas paginadas, filtros, ordenação e operações administrativas no Firestore,
 * com suporte a fallback local para permitir visualização imediata do catálogo.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
let subscriptionCounter = 0; // temporary instrumentation
import { slugify } from '../utils/slugify';

// Produtos iniciais de demonstração baseados nos álbuns reais do Yupoo
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
    description: 'Camisa Edição Especial Espanha 2026 2-Star na cor azul. Tecido tecnológico de alta performance, acabamento premium e caimento impecável.',
    published: true,
    featured: true,
    status: 'published',
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
    description: 'Manto Oficial Espanha 2026 Vermelha com duas estrelas bordadas. Modelagem atlética ideal para colecionadores e uso esportivo.',
    published: true,
    featured: true,
    status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-3',
    name: 'Spain 2026 Special Edition 2-Star - Black Jersey S-4XL',
    slug: 'spain-2026-special-edition-2-star-black-jersey-s-4xl',
    category: 'Seleções',
    subcategory: 'Espanha',
    images: [
      'https://photo.yupoo.com/minkang/71e3e89923/85254535.jpg',
      'https://photo.yupoo.com/minkang/4fd68f2371/5d869be4.jpg'
    ],
    sourceUrl: 'https://minkang.x.yupoo.com/albums/247790610?uid=1',
    sourceProvider: 'yupoo',
    description: 'Camisa Blackout Espanha Edição Especial 2 Estrelas. Visual imponente preto fosco com detalhes monocromáticos.',
    published: true,
    featured: false,
    status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-4',
    name: 'Sporting CP 26/27 Away Kids Kit Jersey Size 16-28',
    slug: 'sporting-cp-26-27-away-kids-kit-jersey-size-16-28',
    category: 'Clubes Europeus',
    subcategory: 'Sporting CP',
    images: [
      'https://photo.yupoo.com/minkang/183f13abf7/870a7176.jpg',
      'https://photo.yupoo.com/minkang/4dff260883/45a58da9.jpg',
      'https://photo.yupoo.com/minkang/b5192fb652/a3d83a04.jpg'
    ],
    sourceUrl: 'https://minkang.x.yupoo.com/albums/254289179?uid=1',
    sourceProvider: 'yupoo',
    description: 'Kit infantil Sporting CP temporada 26/27 uniforme reserva. Conjunto completo para jovens atletas.',
    published: false,
    featured: false,
    status: 'draft',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Normaliza strings para comparações seguras sem sensibilidade a acentos ou maiúsculas
export function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Inferir categoria a partir da origem (sourceUrl)
function inferCategory(product) {
  const url = product.sourceUrl || '';
  if (url.includes('lvguccinike.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('ywq2000.x.yupoo.com')) return 'Chuteiras';

  // Infantil sub‑album within the same domain
  if (url.includes('mzrycm102618.x.yupoo.com') && url.includes('/4742786')) return 'Chuteiras Infantil';
  // Fallback based on previous category values
  if (product.category === 'Catálogo de Chuteiras - 01' ||
      product.category === 'Catálogo de Chuteiras - 02' ||
      product.category === 'Catálogo de Chuteiras - 03') return 'Chuteiras';
  if (product.category === 'Catálogo de Chuteiras - Infantil') return 'Chuteiras Infantil';
  return product.category;
}

// ---------- Team inference utilities ----------

// Canonical list of Brazilian football clubs (including variations that appear in product names).
const PREDEFINED_TEAMS = [
  'Flamengo',
  'Internacional',
  'Palmeiras',
  'Corinthians',
  'São Paulo',
  'Santos',
  'Grêmio',
  'Cruzeiro',
  'Atlético-MG',
  'Vasco',
  'Botafogo',
  'Fluminense',
  'Bahia',
  'Fortaleza',
  'Ceará',
  'Sport',
  'Vitória',
  'Athletico-PR',
  'Coritiba'
];

// Aliases (normalized) -> canonical name. Useful for short forms like "Inter".
const TEAM_ALIASES = {
  'inter': 'Internacional',
  'atletico mg': 'Atlético-MG',
  'atletico-mg': 'Atlético-MG',
  'athletico pr': 'Athletico-PR',
  'athletico-pr': 'Athletico-PR',
  'athletico-pr': 'Athletico-PR'
};

let knownTeamsCache = null;
/** Build a whitelist (Set) of normalized team names from explicit subcategories, predefined list and aliases. */
function getKnownTeams() {
  if (knownTeamsCache) return knownTeamsCache;
  knownTeamsCache = new Set();
  // From explicit subcategories in the data.
  const allProducts = getLocalProducts();
  for (const p of allProducts) {
    if (p && p.subcategory && p.subcategory.trim()) {
      knownTeamsCache.add(normalizeStr(p.subcategory));
    }
  }
  // From the hard‑coded canonical list.
  for (const team of PREDEFINED_TEAMS) {
    knownTeamsCache.add(normalizeStr(team));
  }
  // Also index the alias keys so they can be matched during search.
  for (const alias of Object.keys(TEAM_ALIASES)) {
    knownTeamsCache.add(normalizeStr(alias));
  }
  return knownTeamsCache;
}

/** Infer a team name from a product name.
 * Returns the canonical team name (from PREDEFINED_TEAMS or an explicit subcategory) or '' if none matched.
 */
function inferTeamFromName(name) {
  const nameNorm = normalizeStr(name);
  const teams = getKnownTeams();
  let bestMatch = '';
  for (const teamNorm of teams) {
    if (nameNorm.includes(teamNorm) && teamNorm.length > bestMatch.length) {
      bestMatch = teamNorm;
    }
  }
  if (!bestMatch) return '';
  // Resolve alias to canonical name if applicable.
  const aliasKey = Object.keys(TEAM_ALIASES).find(k => normalizeStr(k) === bestMatch);
  if (aliasKey) return TEAM_ALIASES[aliasKey];
  // Resolve to canonical name from predefined list if present.
  const canonical = PREDEFINED_TEAMS.find(t => normalizeStr(t) === bestMatch);
  if (canonical) return canonical;
  // Fallback: return the normalized match (it may be an existing subcategory value).
  return bestMatch;
}

/** Returns the subcategory for a product.
 * - Uses explicit subcategory when present.
 * - For "Camisetas de Time" and "Camisetas de Time Retrô" with empty subcategory, attempts inference.
 * - Otherwise returns empty string.
 */
export function getProductSubcategory(product) {
  if (!product) return '';
  if (product.subcategory && product.subcategory.trim()) {
    return normalizeStr(product.subcategory);
  }
  const cat = product.category ? product.category.trim() : '';
  if (cat === 'Camisetas de Time' || cat === 'Camisetas de Time Retrô') {
    return inferTeamFromName(product.name || '');
  }
  return '';
}

let liveProductsCache = INITIAL_DEMO_PRODUCTS;
let lastFetchTimestamp = 0;

export async function fetchLatestLocalProducts() {
  const now = Date.now();
  if (now - lastFetchTimestamp > 1200) {
    lastFetchTimestamp = now;
    try {
      // Carrega diretamente o arquivo completo de produtos (src/data/produtos.json)
      const res = await fetch('/src/data/produtos.json?t=' + now);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          liveProductsCache = data;
        }
      }
    } catch (e) {}
  }
  return liveProductsCache;
}

// Gerenciamento da base de dados local: produtos.json é a fonte da verdade oficial
function getLocalProducts() {
  // Carrega edições manuais de admin (se houver) para sobrepor campos sem perder o catálogo
  let adminEdits = {};
  try {
    const savedEdits = localStorage.getItem('ln_sports_admin_edits');
    if (savedEdits) adminEdits = JSON.parse(savedEdits);
  } catch (e) {}

  const merged = [];
  const seenUrls = new Set();
  const sourceList = liveProductsCache && liveProductsCache.length > 0 ? liveProductsCache : INITIAL_DEMO_PRODUCTS;

  for (const imp of sourceList) {
    if (!imp || !imp.sourceUrl) continue;
    if (seenUrls.has(imp.sourceUrl)) continue;
    seenUrls.add(imp.sourceUrl);

    const override = adminEdits[imp.sourceUrl] || adminEdits[imp.slug] || {};
    const product = {
      id: imp.slug || slugify(imp.name),
      ...imp,
      ...override,
      published: imp.published !== false,
      status: imp.status || 'published'
    };
    product.category = inferCategory(product);
    merged.push(product);
  }

  return merged;
}

function saveLocalProducts(products) {
  try {
    localStorage.setItem('ln_sports_products', JSON.stringify(products));
  } catch (e) {}
}

export const PRODUCTS_PER_PAGE = 24;
export const productService = {
  /**
   * Busca produtos com filtros, paginação e status.
   */
  async getProducts({
    status = 'all',
    category = null,
    subcategory = null,
    featured = null,
    limitCount = PRODUCTS_PER_PAGE,
    searchQuery = '',
    sortBy = 'newest'
  } = {}) {
    // Se o Firebase estiver configurado, usa Cloud Firestore
    if (isFirebaseConfigured && db) {
      try {
        let q = collection(db, 'products');
        const constraints = [];

        if (status && status !== 'all') {
          constraints.push(where('status', '==', status));
        }
        if (category) {
          constraints.push(where('category', '==', category));
        }
        if (subcategory) {
          constraints.push(where('subcategory', '==', subcategory));
        }
        if (featured !== null) {
          constraints.push(where('featured', '==', featured));
        }

        // Ordenação
        if (sortBy === 'newest') {
          constraints.push(orderBy('createdAt', 'desc'));
        } else if (sortBy === 'name-asc') {
          constraints.push(orderBy('name', 'asc'));
        } else if (sortBy === 'name-desc') {
          constraints.push(orderBy('name', 'desc'));
        }

        constraints.push(firestoreLimit(limitCount));
        const firestoreQuery = query(q, ...constraints);
        const snapshot = await getDocs(firestoreQuery);

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn("[productService] Fallback local ativado devido a:", error.message);
      }
    }

    // Modo local / JSON oficial
    await fetchLatestLocalProducts();
    let items = [...getLocalProducts()];

    if (status && status !== 'all') {
      items = items.filter(p => p.status === status);
    }
    if (category) {
      const catNorm = normalizeStr(category);
      const catSlug = slugify(category);
      items = items.filter(p => {
        if (!p.category) return false;
        return (
          normalizeStr(p.category) === catNorm ||
          slugify(p.category) === catSlug
        );
      });
    }
    if (subcategory) {
      const subNorm = normalizeStr(subcategory);
      const subSlug = slugify(subcategory);
      items = items.filter(p => {
        if (!p.subcategory) return false;
        return (
          normalizeStr(p.subcategory) === subNorm ||
          slugify(p.subcategory) === subSlug
        );
      });
    }
    if (featured !== null) {
      items = items.filter(p => p.featured === featured);
    }
    if (searchQuery) {
      const q = normalizeStr(searchQuery);
      items = items.filter(p =>
        normalizeStr(p.name).includes(q) ||
        normalizeStr(p.category).includes(q) ||
        normalizeStr(p.subcategory).includes(q)
      );
    }

    // Ordenação local
    if (sortBy === 'name-asc') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      items.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return items.slice(0, limitCount);
  },

  /**
   * Escuta atualizações de produtos em tempo real (onSnapshot no Firestore ou polling local).
   * O callback é acionado automaticamente assim que novos produtos entram no catálogo.
   */
  subscribeProducts({ status = 'all', category = null, limitCount = undefined, callback }) {
  const subscriptionId = ++subscriptionCounter;
  let cancelled = false; // guard to prevent callbacks after unsubscribe
  console.log(`[productService] subscription ${subscriptionId} started for category: ${category}`);
    if (isFirebaseConfigured && db) {
      try {
        const constraints = [];
        if (status && status !== 'all') {
          constraints.push(where('status', '==', status));
        }
        if (category) {
          constraints.push(where('category', '==', category));
        }
        constraints.push(orderBy('createdAt', 'desc'));
        if (limitCount !== undefined && limitCount !== null) {
          constraints.push(firestoreLimit(limitCount));
        }

        const q = query(collection(db, 'products'), ...constraints);
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            console.log(`[productService] subscription ${subscriptionId} onSnapshot callback with ${snapshot.docs.length} docs`);
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!cancelled) callback(items);
          },
          (err) => {
            console.warn("[productService] onSnapshot fallback:", err.message);
          }
        );
        return () => { cancelled = true; if (typeof unsubscribe === 'function') unsubscribe(); };
      } catch (e) {
        console.warn("[productService] Falha ao registrar onSnapshot:", e.message);
      }
    }

    // Modo local: monitora atualizações na base local a cada 1.5 segundos
    let lastFingerprint = '';
    const pollLocal = async () => {
      await fetchLatestLocalProducts();
      const all = getLocalProducts();
      let filtered = [...all];
      if (status && status !== 'all') {
        filtered = filtered.filter(p => p.status === status);
      }
      if (category) {
        const catNorm = normalizeStr(category);
        const catSlug = slugify(category);
        filtered = filtered.filter(p => {
          if (!p.category) return false;
          return (
            normalizeStr(p.category) === catNorm ||
            slugify(p.category) === catSlug
          );
        });
      }
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const currentItems = (limitCount !== undefined && limitCount !== null) ? filtered.slice(0, limitCount) : filtered;
      const fingerprint = `${filtered.length}-${currentItems.map(p => p.slug || p.sourceUrl).join('|')}`;
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        if (!cancelled) callback(currentItems);
      }
    };

    pollLocal();
    const interval = setInterval(pollLocal, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  },

  /**
   * Obtém um produto pelo seu slug único amigável.
   */
  async getProductBySlug(slug) {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, 'products'),
          where('slug', '==', slug),
          firestoreLimit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docItem = snapshot.docs[0];
          return { id: docItem.id, ...docItem.data() };
        }
      } catch (error) {
        console.warn("[productService] Fallback local para slug:", error.message);
      }
    }

    await fetchLatestLocalProducts();
    return getLocalProducts().find(p => p.slug === slug) || null;
  },

  /**
   * Obtém produtos relacionados na mesma categoria ou subcategoria.
   */
  async getRelatedProducts(currentProduct, limitCount = 4) {
    if (!currentProduct) return [];
    const all = await this.getProducts({
      status: 'published',
      category: currentProduct.category,
      limitCount: limitCount + 1
    });
    return all.filter(p => p.slug !== currentProduct.slug).slice(0, limitCount);
  },

  /**
   * Cria ou atualiza um produto no Firestore.
   */
  async saveProduct(productData) {
    const isNew = !productData.id;
    const cleanSlug = productData.slug || slugify(productData.name);

    const payload = {
      name: productData.name,
      slug: cleanSlug,
      category: productData.category || 'Geral',
      subcategory: productData.subcategory || '',
      images: productData.images || [],
      sourceUrl: productData.sourceUrl || '',
      sourceProvider: 'yupoo',
      description: productData.description || '',
      status: productData.status || 'draft',
      published: productData.status === 'published',
      featured: Boolean(productData.featured),
      updatedAt: new Date().toISOString()
    };

    if (isNew) {
      payload.createdAt = new Date().toISOString();
    }

    if (isFirebaseConfigured && db) {
      try {
        const docRef = isNew
          ? doc(collection(db, 'products'))
          : doc(db, 'products', productData.id);

        await setDoc(docRef, payload, { merge: true });
        return { id: docRef.id, ...payload };
      } catch (error) {
        console.error("[productService] Erro ao gravar produto no Firestore:", error);
      }
    }

    // Gravação local
    const current = getLocalProducts();
    let updated;
    if (isNew) {
      const newProduct = { id: `local-${Date.now()}`, ...payload };
      updated = [newProduct, ...current];
    } else {
      updated = current.map(p => p.id === productData.id ? { ...p, ...payload } : p);
    }
    saveLocalProducts(updated);
    return payload;
  },

  /**
   * Altera rapidamente o status de publicação (draft <-> published).
   */
  async togglePublish(productId, currentStatus) {
    const nextStatus = currentStatus === 'published' ? 'draft' : 'published';
    const payload = {
      status: nextStatus,
      published: nextStatus === 'published',
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'products', productId), payload);
        return payload;
      } catch (error) {
        console.error("[productService] Erro ao alterar status no Firestore:", error);
      }
    }

    const current = getLocalProducts();
    const updated = current.map(p => p.id === productId ? { ...p, ...payload } : p);
    saveLocalProducts(updated);
    return payload;
  },

  /**
   * Altera o status de destaque (featured).
   */
  async toggleFeatured(productId, currentFeatured) {
    const payload = {
      featured: !currentFeatured,
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'products', productId), payload);
        return payload;
      } catch (error) {
        console.error("[productService] Erro ao alterar destaque:", error);
      }
    }

    const current = getLocalProducts();
    const updated = current.map(p => p.id === productId ? { ...p, ...payload } : p);
    saveLocalProducts(updated);
    return payload;
  },

  /**
   * Salva o índice da foto principal de um produto nos adminEdits do localStorage.
   * Funciona tanto no modo local quanto como complemento ao Firestore.
   */
  saveMainImageIndex(productSourceUrl, productSlug, index) {
    let adminEdits = {};
    try {
      const saved = localStorage.getItem('ln_sports_admin_edits');
      if (saved) adminEdits = JSON.parse(saved);
    } catch (e) {}

    // Usa sourceUrl como chave primária (igual ao getLocalProducts)
    const key = productSourceUrl || productSlug;
    adminEdits[key] = { ...(adminEdits[key] || {}), mainImageIndex: index };
    localStorage.setItem('ln_sports_admin_edits', JSON.stringify(adminEdits));

    // Se Firebase configurado, persiste também no Firestore
    if (isFirebaseConfigured && db && productSlug) {
      import('firebase/firestore').then(({ query, collection, where, limit, getDocs, updateDoc }) => {
        const q = query(collection(db, 'products'), where('slug', '==', productSlug), limit(1));
        getDocs(q).then(snap => {
          if (!snap.empty) {
            updateDoc(snap.docs[0].ref, { mainImageIndex: index, updatedAt: new Date().toISOString() })
              .catch(e => console.warn('[productService] Erro ao salvar mainImageIndex no Firestore:', e));
          }
        }).catch(() => {});
      }).catch(() => {});
    }

    return index;
  },

  /**
   * Remove um produto.
   */
  async deleteProduct(productId) {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        return true;
      } catch (error) {
        console.error("[productService] Erro ao excluir no Firestore:", error);
      }
    }

    const current = getLocalProducts();
    saveLocalProducts(current.filter(p => p.id !== productId));
    return true;
  },

  /**
   * Retorna métricas do painel administrativo.
   */
  async getDashboardMetrics() {
    const all = await this.getProducts({ status: 'all', limitCount: 5000 });
    const categoriesSet = new Set();

    let published = 0;
    let draft = 0;
    let inactive = 0;
    let featured = 0;
    let withoutImages = 0;
    let withoutDescription = 0;

    for (const p of all) {
      if (p.category) categoriesSet.add(p.category);
      if (p.status === 'published') published++;
      else if (p.status === 'inactive') inactive++;
      else draft++;

      if (p.featured) featured++;
      if (!p.images || p.images.length === 0) withoutImages++;
      if (!p.description) withoutDescription++;
    }

    return {
      total: all.length,
      published,
      draft,
      inactive,
      featured,
      categoriesCount: categoriesSet.size,
      withoutImages,
      withoutDescription
    };
  }
};
