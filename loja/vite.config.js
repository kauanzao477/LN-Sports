import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';

/**
 * Middleware para contornar o bloqueio de hotlinking do Yupoo (erro 567)
 * O servidor Vite busca a imagem no CDN photo.yupoo.com com o header Referer correto do catálogo
 * e entrega os bytes diretamente para o navegador com cache ativado.
 *
 * Repassa também a senha (cookie indexlockcode) dos catálogos protegidos,
 * igual ao scraper (scraper/crawler.py). Sem isso o Yupoo devolve
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

// Hashes SHA-256 de placeholders do Yupoo (fotos removidas pelo Yupoo).
// Quando o CDN devolve um deles com HTTP 200, é uma imagem FAKE ("marca
// d'água" verde) no lugar da foto real — respondemos 404 para o site
// exibir o fallback/pular para a próxima foto em vez da imagem falsa.
// Comparação por hash exato: nunca afeta foto real.
const YUPOO_PLACEHOLDER_HASHES = new Set([
  'c40fff23302bf779252e28d3177eb9482f27770aee176011bf73de0390457ddf', // "图片暂时无法展示" (17.670 bytes)
]);

function isYupooPlaceholder(buffer) {
  if (!buffer || buffer.length === 0) return false;
  return YUPOO_PLACEHOLDER_HASHES.has(createHash('sha256').update(buffer).digest('hex'));
}

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
      const referer = getYupooReferer(account);
      const cookie = getYupooCookie(account);

      const proxyHeaders = {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      };
      if (cookie) proxyHeaders['Cookie'] = cookie;

      const upstream = await fetch(targetUrl, {
        headers: proxyHeaders
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
      if (isYupooPlaceholder(buffer)) {
        res.statusCode = 404;
        res.end('Yupoo placeholder (foto removida pelo Yupoo)');
        return;
      }
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
    port: 5173,
    open: false,
    proxy: {
      // Redireciona chamadas /api/* (exceto /api/image-proxy que o plugin já trata)
      // para o Express server durante desenvolvimento
      '/api/products': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/categories': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/settings': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  }
});
