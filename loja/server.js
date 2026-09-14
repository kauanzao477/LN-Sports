import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Image proxy handler (same logic as vite plugin)
async function imageProxyHandler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }
  let targetParsed;
  try {
    targetParsed = new URL(targetUrl);
  } catch {
    res.status(400).send('Invalid url parameter');
    return;
  }
  if (!targetParsed.hostname.includes('yupoo.com')) {
    res.status(403).send('Only yupoo.com images are allowed');
    return;
  }
  const account = targetParsed.pathname.split('/').filter(Boolean)[0] || 'minkang';
  const referer = `https://${account}.x.yupoo.com/`;
  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
      return;
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('[Image Proxy Error]', err);
    res.status(500).send('Failed to proxy image');
  }
}

// Proxy route
app.get('/api/image-proxy', imageProxyHandler);

// Serve static files from dist
app.use(express.static(path.resolve(__dirname, 'dist')));

// SPA fallback – serve index.html for non‑api routes that are not static files
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
