import { withDb, rowToProduct } from '../../_shared/db.js';
import { jsonResponse } from '../../_shared/auth.js';

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
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 24));
  const offset = (page - 1) * limit;

  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');
  const featured = url.searchParams.get('featured');
  const sort = url.searchParams.get('sort') || 'newest';

  try {
    const result = await withDb(env, async (client) => {
      const conditions = [];
      const values = [];
      let paramIdx = 1;

      if (status && status !== 'all') {
        conditions.push(`status = $${paramIdx++}`);
        values.push(status);
      }

      if (featured !== null && featured !== undefined && featured !== '') {
        conditions.push(`featured = $${paramIdx++}`);
        values.push(featured === 'true' || featured === true);
      }

      if (category && category.trim()) {
        conditions.push(`lower(category) LIKE $${paramIdx++}`);
        values.push(`%${category.trim().toLowerCase()}%`);
      }

      if (search && search.trim()) {
        conditions.push(`(lower(name) LIKE $${paramIdx} OR lower(description) LIKE $${paramIdx})`);
        values.push(`%${search.trim().toLowerCase()}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      let orderBy = 'ORDER BY id DESC';
      if (sort === 'oldest') orderBy = 'ORDER BY id ASC';
      else if (sort === 'name_asc') orderBy = 'ORDER BY name ASC';
      else if (sort === 'name_desc') orderBy = 'ORDER BY name DESC';

      const countSql = `SELECT COUNT(*) as total FROM products ${whereClause}`;
      const countRes = await client.query(countSql, values);
      const total = parseInt(countRes.rows[0]?.total, 10) || 0;

      const dataSql = `SELECT * FROM products ${whereClause} ${orderBy} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      const dataRes = await client.query(dataSql, [...values, limit, offset]);

      return {
        data: dataRes.rows.map(rowToProduct),
        
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total,
        ,
      };
    });

    return jsonResponse(result);
  } catch (err) {
    console.error('Database Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno ao consultar o banco de dados.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  }
}
