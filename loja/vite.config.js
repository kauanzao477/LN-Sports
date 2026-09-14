import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Middleware para contornar o bloqueio de hotlinking do Yupoo (erro 567)
 * O servidor Vite busca a imagem no CDN photo.yupoo.com com o header Referer correto do catálogo
 * e entrega os bytes diretamente para o navegador com cache ativado.
 */
function yupooImageProxyPlugin() {
  const handler = async (req, res, next) => {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const targetUrl = parsedUrl.searchParams.get('url');

      if (!targetUrl) {
        res.statusCode = 400;
        res.end('Missing url parameter');
        return;
      }

      let targetParsed;
      try {
        targetParsed = new URL(targetUrl);
      } catch {
        res.statusCode = 400;
        res.end('Invalid url parameter');
        return;
      }

      if (!targetParsed.hostname.includes('yupoo.com')) {
        res.statusCode = 403;
        res.end('Only yupoo.com images are allowed');
        return;
      }

      const pathParts = targetParsed.pathname.split('/').filter(Boolean);
      const account = pathParts[0] || 'minkang';
      const referer = `https://${account}.x.yupoo.com/`;

      const upstream = await fetch(targetUrl, {
        headers: {
          'Referer': referer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });

      if (!upstream.ok) {
        res.statusCode = upstream.status;
        res.end(`Upstream error: ${upstream.status} ${upstream.statusText}`);
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

      const arrayBuffer = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err) {
      console.error('[Yupoo Image Proxy Error]:', err);
      res.statusCode = 500;
      res.end('Failed to proxy image');
    }
  };

  return {
    name: 'yupoo-image-proxy',
    configureServer(server) {
      server.middlewares.use('/api/image-proxy', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/image-proxy', handler);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), yupooImageProxyPlugin()],
  server: {
    port: 3000,
    open: false
  }
});
