import { withDb, rowToProduct } from '../../../_shared/db.js';
import { requireAdmin, jsonResponse } from '../../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPut(context) {
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

  const {
    name,
    slug,
    category,
    subcategory,
    images,
    description,
    status,
    featured,
    mainImageIndex,
  } = body;

  try {
    const updated = await withDb(env, async (client) => {
      const { rows } = await client.query(`
        UPDATE products SET
          name = COALESCE($1, name),
          slug = COALESCE($2, slug),
          category = COALESCE($3, category),
          subcategory = COALESCE($4, subcategory),
          images = COALESCE($5, images),
          description = COALESCE($6, description),
          status = COALESCE($7, status),
          published = COALESCE($8, published),
          featured = COALESCE($9, featured),
          main_image_index = COALESCE($10, main_image_index),
          updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `, [
        name || null,
        slug || null,
        category || null,
        subcategory || null,
        images ? JSON.stringify(images) : null,
        description || null,
        status || null,
        status ? status === 'published' : null,
        featured !== undefined ? featured : null,
        mainImageIndex !== undefined ? mainImageIndex : null,
        id,
      ]);

      if (!rows.length) return null;
      return rowToProduct(rows[0]);
    });

    if (!updated) {
      return jsonResponse({ error: 'Produto não encontrado' }, 404);
    }
    return jsonResponse(updated);
  } catch (err) {
    console.error('[Pages Functions PUT /api/admin/products/:id] Error:', err.message);
    return jsonResponse({ error: 'Erro ao atualizar produto no banco' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  const { errorResponse } = requireAdmin(request, env);
  if (errorResponse) return errorResponse;

  const id = params.id;

  try {
    const success = await withDb(env, async (client) => {
      const { rows } = await client.query(
        `UPDATE products SET status = 'inactive', published = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      return rows.length > 0;
    });

    if (!success) {
      return jsonResponse({ error: 'Produto não encontrado' }, 404);
    }
    return jsonResponse({ ok: true, id });
  } catch (err) {
    console.error('[Pages Functions DELETE /api/admin/products/:id] Error:', err.message);
    return jsonResponse({ error: 'Erro ao inativar produto' }, 500);
  }
}
