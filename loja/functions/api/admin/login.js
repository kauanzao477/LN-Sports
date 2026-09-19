import bcrypt from 'bcryptjs';
import { withDb } from '../../_shared/db.js';
import { signAdminToken, jsonResponse } from '../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return jsonResponse({ error: 'Email e senha obrigatórios' }, 400);
  }

  const normEmail = String(email).trim().toLowerCase();

  // 1. Tenta autenticar pelo banco via Hyperdrive / DATABASE_URL se disponível
  try {
    const adminUser = await withDb(env, async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM admins WHERE lower(email) = lower($1) LIMIT 1',
        [normEmail]
      );
      if (!rows.length) return null;
      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password_hash);
      return valid ? admin : null;
    });

    if (adminUser) {
      const token = signAdminToken(
        { id: adminUser.id, email: adminUser.email, role: 'admin' },
        env
      );
      return jsonResponse({ token, email: adminUser.email });
    }
  } catch (dbErr) {
    console.warn('[Pages Functions /api/admin/login] DB check bypass/fallback:', dbErr.message);
  }

  // 2. Valida com as variáveis de ambiente seguras (hash bcrypt)
  const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminHash = env.ADMIN_PASSWORD_HASH;

  if (adminEmail && adminHash && normEmail === adminEmail) {
    const match = await bcrypt.compare(password, adminHash).catch(() => false);
    if (match) {
      const token = signAdminToken(
        { email: env.ADMIN_EMAIL, role: 'admin' },
        env
      );
      return jsonResponse({ token, email: env.ADMIN_EMAIL });
    }
  }

  return jsonResponse({ error: 'Credenciais inválidas' }, 401);
}
