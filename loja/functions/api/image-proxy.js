/**
 * Cloudflare Pages Function
 * Rota: /api/image-proxy?url=...
 *
 * Executada na rede edge do Cloudflare Pages sem depender do Render.
 * Fornece os cabeçalhos Referer/Cookie necessários para o CDN do Yupoo
 * e rejeita com 404 imagens-placeholder ("图片暂时无法展示") que o Yupoo
 * devolve com HTTP 200 quando a foto foi removida ou o álbum está bloqueado.
 */

// ── Senhas dos catálogos protegidos ──────────────────────────────────────────
const YUPOO_LOCK_CODES = {
  '1998shoe': 'HJH001077',   // Tênis Casuais
  'aj-dongli': '888888',      // Tênis Esportivos
};

// ── Conta da foto → subdomínio do álbum (para o Referer correto) ─────────────
const YUPOO_ACCOUNT_DOMAIN = {
  'ywq2000_v':       'ywq2000',
  'mzrycm102618':    'mzrycm102618',
  'lvguccinike':     'lvguccinike',
  'minkang':         'minkang',
  'aj-dongli':       'aj-dongli',
  '1998shoe':        '1998shoe',
};

function getYupooReferer(account) {
  const domain = YUPOO_ACCOUNT_DOMAIN[account] || account;
  return `https://${domain}.x.yupoo.com/`;
}

function getYupooCookie(account) {
  const code = YUPOO_LOCK_CODES[account];
  return code ? `indexlockcode=${code}; indexlockcodeRemember=${code}` : null;
}

// ── Hashes SHA-256 de placeholders do Yupoo ──────────────────────────────────
// Quando o Yupoo devolve HTTP 200 com uma dessas imagens-sentinel no lugar da
// foto real, o proxy responde 404 para que o frontend pule para a próxima foto.
const YUPOO_PLACEHOLDER_HASHES = new Set([
  'c40fff23302bf779252e28d3177eb9482f27770aee176011bf73de0390457ddf', // "图片暂时无法展示" 17 670 B
]);

async function sha256Hex(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Handler principal ─────────────────────────────────────────────────────────
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

  // Extrai a conta do primeiro segmento do path (ex: /ywq2000_v/photo/...)
  const pathParts = parsedTarget.pathname.split('/').filter(Boolean);
  const account = pathParts[0] || 'minkang';
  const referer = getYupooReferer(account);
  const cookie = getYupooCookie(account);

  const headers = new Headers({
    'Referer': referer,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
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
      },
    });

    if (!upstreamRes.ok) {
      return new Response(`Upstream error: ${upstreamRes.status}`, { status: upstreamRes.status });
    }

    // Lê o body completo para poder calcular o hash
    const arrayBuffer = await upstreamRes.arrayBuffer();

    // Rejeita placeholders mesmo que o upstream tenha devolvido 200
    const hash = await sha256Hex(arrayBuffer);
    if (YUPOO_PLACEHOLDER_HASHES.has(hash)) {
      return new Response('Yupoo placeholder (foto removida pelo Yupoo)', { status: 404 });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    const respHeaders = new Headers({
      'Content-Type': contentType,
      'Content-Length': String(arrayBuffer.byteLength),
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      'Access-Control-Allow-Origin': '*',
    });

    return new Response(arrayBuffer, { status: 200, headers: respHeaders });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
}
