import { withDb } from '../_shared/db.js';
import { jsonResponse } from '../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

const OFFICIAL_CATEGORIES = [
  { id: 'camisetas-de-time', name: 'Camisetas de Time', slug: 'camisetas-de-time', subcategories: [], productCount: 5296 },
  { id: 'camisetas-de-time-retro', name: 'Camisetas de Time Retrô', slug: 'camisetas-de-time-retro', subcategories: [], productCount: 2323 },
  { id: 'chuteiras', name: 'Chuteiras', slug: 'chuteiras', subcategories: [], productCount: 8062 },
  { id: 'chuteiras-infantil', name: 'Chuteiras Infantil', slug: 'chuteiras-infantil', subcategories: [], productCount: 159 },
  { id: 'sapatilhas-de-atletismo', name: 'Sapatilhas de Atletismo', slug: 'sapatilhas-de-atletismo', subcategories: [], productCount: 11 },
  { id: 'tenis-casuais', name: 'Tênis Casuais', slug: 'tenis-casuais', subcategories: [], productCount: 6705 },
  { id: 'tenis-on-running-e-hoka', name: 'Tênis On Running e HOKA', slug: 'tenis-on-running-e-hoka', subcategories: [], productCount: 2651 },
  { id: 'tenis-esportivos', name: 'Tênis Esportivos', slug: 'tenis-esportivos', subcategories: [], productCount: 25015 },
];

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const list = await withDb(env, async (client) => {
      const { rows } = await client.query(`
        SELECT category, COUNT(*) as count
        FROM products
        WHERE status = 'published' OR published = true
        GROUP BY category
      `);

      if (!rows.length) return OFFICIAL_CATEGORIES;

      const countsMap = new Map();
      for (const r of rows) {
        const cat = (r.category || '').toLowerCase().trim();
        const cnt = parseInt(r.count, 10) || 0;
        countsMap.set(cat, (countsMap.get(cat) || 0) + cnt);
      }

      return OFFICIAL_CATEGORIES.map((c) => ({
        ...c,
        productCount: countsMap.get(c.name.toLowerCase()) || c.productCount,
      }));
    });

    return jsonResponse(list);
  } catch (err) {
    console.warn('[Pages Functions GET /api/categories] DB offline, using static categories:', err.message);
    return jsonResponse(OFFICIAL_CATEGORIES);
  }
}
