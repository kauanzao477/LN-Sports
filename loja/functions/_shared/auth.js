import jwt from 'jsonwebtoken';

export function getJwtSecret(env) {
  return env.ADMIN_JWT_SECRET || 'ln-sports-dev-secret-change-in-prod';
}

export function signAdminToken(payload, env) {
  const secret = getJwtSecret(env);
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

export function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  try {
    const secret = getJwtSecret(env);
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

export function requireAdmin(request, env) {
  const admin = verifyAuth(request, env);
  if (!admin) {
    return {
      errorResponse: jsonResponse({ error: 'Token inválido ou expirado' }, 401),
      admin: null,
    };
  }
  return { errorResponse: null, admin };
}
