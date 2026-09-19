import { requireAdmin, jsonResponse } from '../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;

  const { errorResponse } = requireAdmin(request, env);
  if (errorResponse) return errorResponse;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const { name, slug, subcategories, productCount } = body || {};
  return jsonResponse({ ok: true, name, slug, subcategories, productCount });
}
