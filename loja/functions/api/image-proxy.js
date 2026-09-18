/**
 * Cloudflare Pages Function
 * Rota: /api/image-proxy?url=...
 *
 * Executada na rede edge do Cloudflare Pages sem depender do Render.
 * Fornece os cabeçalhos Referer/Cookie necessários para o CDN do Yupoo.
 */

const YUPOO_LOCK_CODES = {
  '1998shoe': 'HJH001077',   // Tênis Casuais
  'aj-dongli': '888888',      // Tênis Esportivos
};

const YUPOO_ACCOUNT_DOMAIN = {
  'ywq2000_v': 'ywq2000',
};

function getYupooReferer(account) {
  const domain = YUPOO_ACCOUNT_DOMAIN[account] || account;
  return `https://${domain}.x.yupoo.com/`;
}

function getYupooCookie(account) {
  const code = YUPOO_LOCK_CODES[account];
  return code ? `indexlockcode=${code}; indexlockcodeRemember=${code}` : null;
}

export async function onRequest(context) {
  const { request } = context;
  const reqUrl = new URL(request.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response('Invalid url parameter', { status: 400 });
  }

  if (!parsedTarget.hostname.includes('yupoo.com')) {
    return new Response('Only yupoo.com images are supported', { status: 403 });
  }

  const pathParts = parsedTarget.pathname.split('/').filter(Boolean);
  const account = pathParts[0] || 'minkang';
  const referer = getYupooReferer(account);
  const cookie = getYupooCookie(account);

  const headers = new Headers({
    'Referer': referer,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  });

  if (cookie) {
    headers.set('Cookie', cookie);
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers,
      cf: {
        cacheTtl: 604800,
        cacheEverything: true,
      }
    });

    if (!upstreamRes.ok) {
      return new Response(`Upstream error: ${upstreamRes.status}`, { status: upstreamRes.status });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    const respHeaders = new Headers();
    respHeaders.set('Content-Type', contentType);
    respHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    respHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(upstreamRes.body, {
      status: 200,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
}
