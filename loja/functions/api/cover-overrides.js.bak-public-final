import { withDb } from '../_shared/db.js';
import { jsonResponse } from '../_shared/auth.js';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const rows = await withDb(env, async (client) => {
      const result = await client.query(`
        SELECT
          id,
          slug,
          source_url,
          cover_override_index
        FROM products
        WHERE cover_override_index IS NOT NULL
      `);

      return result.rows;
    });

    return jsonResponse(
      rows.map(row => ({
        id: String(row.id),
        slug: row.slug,
        sourceUrl: row.source_url || '',
        coverOverrideIndex: Number(row.cover_override_index),
      }))
    );
  } catch (err) {
    console.error(
      '[Pages Functions GET /api/cover-overrides] Error:',
      err.message
    );

    return jsonResponse(
      { error: err.message },
      500
    );
  }
}
