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
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const { images, coverIndex } = body;

  try {
    const updated = await withDb(env, async (client) => {
      let newImages = images;

      if (!newImages && coverIndex !== undefined) {
        const current = await client.query('SELECT images FROM products WHERE id = $1', [id]);
        if (current.rows.length) {
          const raw = current.rows[0].images || [];
          const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(arr) && arr[coverIndex]) {
            const chosen = arr[coverIndex];
            newImages = [chosen, ...arr.filter((_, i) => i !== coverIndex)];
          }
        }
      }

      const { rows } = await client.query(
        `UPDATE products SET images = COALESCE($1, images), main_image_index = 0, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newImages ? JSON.stringify(newImages) : null, id]
      );
      if (!rows.length) return null;
      return rowToProduct(rows[0]);
    });

    if (!updated) {
      return jsonResponse({ error: 'Produto não encontrado' }, 404);
    }
    return jsonResponse(updated);
  } catch (err) {
    console.error('[Pages Functions PATCH .../cover] Error:', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}
