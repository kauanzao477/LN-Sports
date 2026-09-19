import { withDb, rowToProduct } from '../../_shared/db.js';
import { jsonResponse } from '../../_shared/auth.js';

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

export async function onRequestGet(context) {
  const { params, env } = context;
  const slugOrId = params.slug;

  try {
    const product = await withDb(env, async (client) => {
      const isId = /^\d+$/.test(slugOrId);
      const sql = isId
        ? 'SELECT * FROM products WHERE id = $1 LIMIT 1'
        : 'SELECT * FROM products WHERE slug = $1 LIMIT 1';
      const { rows } = await client.query(sql, [slugOrId]);
      if (!rows.length) return null;
      return rowToProduct(rows[0]);
    });

    if (!product) {
      return jsonResponse({ error: 'Produto não encontrado' }, 404);
    }
    return jsonResponse(product);
  } catch (err) {
    console.warn('[Pages Functions GET /api/products/:slug] Error:', err.message);
    return jsonResponse({ error: 'Produto não encontrado' }, 404);
  }
}
