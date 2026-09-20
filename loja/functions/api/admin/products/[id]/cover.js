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

  const coverIndex = Number(body.coverIndex);

  try {
    const updated = await withDb(env, async (client) => {
      const current = await client.query(
        'SELECT images FROM products WHERE id = $1',
        [id]
      );

      if (!current.rows.length) return null;

      const rawImages = current.rows[0].images || [];
      const images =
        typeof rawImages === 'string'
          ? JSON.parse(rawImages)
          : rawImages;

      if (
        !Array.isArray(images) ||
        !Number.isInteger(coverIndex) ||
        coverIndex < 0 ||
        coverIndex >= images.length
      ) {
        throw new Error('Índice de capa inválido');
      }

      const { rows } = await client.query(
        `UPDATE products
         SET main_image_index = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [coverIndex, id]
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
