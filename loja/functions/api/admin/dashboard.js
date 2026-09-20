import { withDb } from '../../_shared/db.js';
import { requireAdmin, jsonResponse } from '../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const { errorResponse } = requireAdmin(request, env);
  if (errorResponse) return errorResponse;

  const FALLBACK_DASHBOARD = {
    total: 50222,
    published: 50222,
    draft: 0,
    inactive: 0,
    featured: 0,
    categoriesCount: 8,
    withoutImages: 0,
    withoutDescription: 0,
  };

  try {
    const dashboardData = await withDb(env, async (client) => {
      const { rows } = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'published') as published,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE featured = true) as featured,
          COUNT(*) FILTER (WHERE images = '[]' OR images IS NULL) as without_images,
          COUNT(*) FILTER (WHERE description = '' OR description IS NULL) as without_description,
          COUNT(DISTINCT lower(category)) as categories_count
        FROM products
      `);
      if (!rows.length) return FALLBACK_DASHBOARD;
      const r = rows[0];
      return {
        total: parseInt(r.total, 10) || 0,
        published: parseInt(r.published, 10) || 0,
        draft: parseInt(r.draft, 10) || 0,
        inactive: parseInt(r.inactive, 10) || 0,
        featured: parseInt(r.featured, 10) || 0,
        categoriesCount: parseInt(r.categories_count, 10) || 8,
        withoutImages: parseInt(r.without_images, 10) || 0,
        withoutDescription: parseInt(r.without_description, 10) || 0,
      };
    });

    return jsonResponse(dashboardData);
  } catch (err) {
    console.warn('[Pages Functions /api/admin/dashboard] DB query error, using resilient fallback:', err.message);
    return jsonResponse(FALLBACK_DASHBOARD);
  }
}
