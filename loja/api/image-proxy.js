/**
 * Serverless Function para Vercel / Netlify
 * Rota: /api/image-proxy?url=...
 */
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
    const referer = `https://${account}.x.yupoo.com/`;

    const upstream = await fetch(url, {
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[Vercel Image Proxy Error]:', err);
    return res.status(500).send('Failed to proxy image');
  }
}
