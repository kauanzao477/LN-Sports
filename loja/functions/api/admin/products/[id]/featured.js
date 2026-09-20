import { withDb, rowToProduct } from '../../../../_shared/db.js';
import { requireAdmin, jsonResponse } from '../../../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;

  const { errorResponse } = requireAdmin(request, env);
  if (errorResponse) return errorResponse;

  const id = params.id;

  try {
    const updated = await withDb(env, async (client) => {
      const { rows } = await client.query(
        `UPDATE products
         SET featured = NOT featured,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (!rows.length) return null;

      return rowToProduct(rows[0]);
    });

    if (!updated) {
      return jsonResponse({ error: 'Produto não encontrado' }, 404);
    }

    return jsonResponse(updated);
  } catch (err) {
    console.error('[Pages Functions PATCH .../featured] Error:', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}