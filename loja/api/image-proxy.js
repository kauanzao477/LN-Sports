/**
 * Serverless Function para Vercel / Netlify
 * Rota: /api/image-proxy?url=...
 *
 * Repassa ao CDN do Yupoo os mesmos headers/cookies que o scraper usa
 * (scraper/crawler.py): Referer do domínio do álbum + senha
 * (indexlockcode) dos catálogos protegidos. Sem isso o Yupoo devolve
 * imagem de bloqueio/marca d'água no lugar da foto real.
 */

// Senhas dos catálogos protegidos (iguais às do scraper/crawler.py)
const YUPOO_LOCK_CODES = {
  '1998shoe': 'HJH001077',   // Tênis Casuais
  'aj-dongli': '888888',      // Tênis Esportivos
};

// Conta da foto -> subdomínio do álbum (para o Referer correto).
// Ex: fotos 'ywq2000_v' pertencem ao álbum 'ywq2000.x.yupoo.com'.
const YUPOO_ACCOUNT_DOMAIN = {
  'ywq2000_v':    'ywq2000',
  'mzrycm102618': 'mzrycm102618',
  'lvguccinike':  'lvguccinike',
  'minkang':      'minkang',
  'aj-dongli':    'aj-dongli',
  '1998shoe':     '1998shoe',
};

function getYupooReferer(account) {
  const domain = YUPOO_ACCOUNT_DOMAIN[account] || account;
  return `https://${domain}.x.yupoo.com/`;
}

function getYupooCookie(account) {
  const code = YUPOO_LOCK_CODES[account];
  return code ? `indexlockcode=${code}; indexlockcodeRemember=${code}` : null;
}

// Hashes SHA-256 de placeholders do Yupoo (fotos removidas pelo Yupoo).
// Quando o CDN devolve um deles com HTTP 200, é uma imagem FAKE ("marca
// d'água" verde) no lugar da foto real — respondemos 404 para o site
// exibir o fallback/pular para a próxima foto em vez da imagem falsa.
// Comparação por hash exato: nunca afeta foto real.
import { createHash } from 'crypto';
const YUPOO_PLACEHOLDER_HASHES = new Set([
  'c40fff23302bf779252e28d3177eb9482f27770aee176011bf73de0390457ddf', // "图片暂时无法展示" (17.670 bytes)
]);

function isYupooPlaceholder(buffer) {
  if (!buffer || buffer.length === 0) return false;
  return YUPOO_PLACEHOLDER_HASHES.has(createHash('sha256').update(buffer).digest('hex'));
}

export default async function handler(req, res) {
  try {
    const { url } = req.query || {};
    if (!url) {
      return res.status(400).send('Missing url parameter');
    }

    const targetParsed = new URL(url);
    if (!targetParsed.hostname.includes('yupoo.com')) {
      return res.status(403).send('Only yupoo.com images are supported');
    }

    const pathParts = targetParsed.pathname.split('/').filter(Boolean);
    const account = pathParts[0] || 'minkang';
    const referer = getYupooReferer(account);
    const cookie = getYupooCookie(account);

    const headers = {
      'Referer': referer,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    };
    if (cookie) headers['Cookie'] = cookie;

    const upstream = await fetch(url, { headers });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (isYupooPlaceholder(buffer)) {
      return res.status(404).send('Yupoo placeholder (foto removida pelo Yupoo)');
    }
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[Vercel Image Proxy Error]:', err);
    return res.status(500).send('Failed to proxy image');
  }
}
