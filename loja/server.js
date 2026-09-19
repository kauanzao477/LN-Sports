import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { createHash } from 'crypto';
import { resolveCoverIndex } from './src/utils/coverUtils.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

function normalizeCategory(cat = '', url = '') {
  if (url.includes('lvguccinike.x.yupoo.com') || url.includes('ywq2000.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('mzrycm102618.x.yupoo.com') && url.includes('/4742786')) return 'Chuteiras Infantil';
  if (cat.startsWith('Catálogo de Chuteiras - 0') || cat.startsWith('Catalogo de Chuteiras - 0')) return 'Chuteiras';
  if (cat === 'Catálogo de Chuteiras - Infantil' || cat.includes('Infantil')) return 'Chuteiras Infantil';
  if (cat.toLowerCase().startsWith('tênis casuais') || cat.toLowerCase().startsWith('tenis casuais')) return 'Tênis Casuais';
  if (cat.toLowerCase().startsWith('tênis esportivos') || cat.toLowerCase().startsWith('tenis esportivos')) return 'Tênis Esportivos';
  return cat;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yupoo — autenticação do proxy de imagens (igual ao scraper/crawler.py).
// Sem o Referer correto + senha (cookie indexlockcode) dos catálogos
// protegidos, o Yupoo devolve imagem de bloqueio/marca d'água.
// ─────────────────────────────────────────────────────────────────────────────
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

function buildYupooProxyHeaders(account) {
  const headers = {
    'Referer': getYupooReferer(account),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };
  const cookie = getYupooCookie(account);
  if (cookie) headers['Cookie'] = cookie;
  return headers;
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

// In-memory catalog fallback quando DATABASE_URL não estiver configurada
let memoryProducts = null;
function getMemoryProducts() {
  if (!memoryProducts) {
    const candidatePaths = [
      path.resolve(__dirname, 'src', 'data', 'produtos.json'),
      path.resolve(__dirname, 'public', 'data', 'produtos.json'),
      path.resolve(__dirname, 'dist', 'data', 'produtos.json'),
      path.resolve(__dirname, 'dist', 'produtos.json'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const list = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (Array.isArray(list) && list.length > 0) {
            memoryProducts = list.map((item, idx) => ({
              id: item.id || String(idx + 1),
              name: item.name || '',
              slug: item.slug || (item.name ? item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `prod-${idx}`),
              category: normalizeCategory(item.category || '', item.sourceUrl || ''),
              originalCategory: item.originalCategory || item.category || '',
              subcategory: item.subcategory || '',
              images: Array.isArray(item.images) ? item.images : [],
              sourceUrl: item.sourceUrl || '',
              sourceProvider: item.sourceProvider || 'yupoo',
              description: item.description || '',
              published: item.published !== false,
              featured: !!item.featured,
              status: item.status || 'published',
              coverHash: item.coverHash || '',
              mainImageIndex: item.mainImageIndex || 0,
              createdAt: item.createdAt || new Date(Date.now() - idx * 1000).toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString()
            }));
            console.log(`[MemoryCatalog] Carregados ${memoryProducts.length} produtos em memória para fallback resiliente.`);
            break;
          }
        } catch (err) {
          console.error('[MemoryCatalog] Erro ao carregar produtos.json:', err.message);
        }
      }
    }
  }
  return memoryProducts || [];
}

// Função de busca e paginação em memória (fallback idêntico ao PostgreSQL)
function queryMemoryProducts(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
  const offset = (page - 1) * limit;
  const category = req.query.category || null;
  const subcategory = req.query.subcategory || null;
  const status = req.query.status || null;
  const search = req.query.search ? req.query.search.toLowerCase().trim() : null;
  const sort = req.query.sort || 'newest';
  const featured = req.query.featured !== undefined ? req.query.featured === 'true' : null;

  let list = getMemoryProducts();

  if (status && status !== 'all') {
    list = list.filter(p => p.status === status);
  }
  if (category) {
    const catNorm = category.toLowerCase().trim();
    list = list.filter(p => {
      const pCat = (p.category || '').toLowerCase();
      if (catNorm === 'tênis casuais' || catNorm === 'tenis casuais' || catNorm === 'tenis-casuais') {
        return pCat.startsWith('tênis casuais') || pCat.startsWith('tenis casuais');
      }
      if (catNorm === 'tênis esportivos' || catNorm === 'tenis esportivos' || catNorm === 'tenis-esportivos') {
        return pCat.startsWith('tênis esportivos') || pCat.startsWith('tenis esportivos');
      }
      if (catNorm === 'chuteiras' || catNorm === 'chuteira') {
        return pCat === 'chuteiras' || pCat.includes('chuteiras - 0');
      }
      if (catNorm === 'chuteiras infantil' || catNorm === 'chuteiras-infantil' || catNorm === 'chuteira infantil') {
        return pCat === 'chuteiras infantil' || pCat.includes('chuteiras - infantil') || pCat.includes('infantil');
      }
      if (catNorm === 'tênis on running e hoka' || catNorm === 'tenis on running e hoka' || catNorm === 'tenis-on-running-e-hoka') {
        return pCat.includes('on running') || pCat.includes('hoka');
      }
      if (catNorm === 'camisetas de time' || catNorm === 'camisetas-de-time') {
        return pCat === 'camisetas de time';
      }
      if (catNorm === 'camisetas de time retrô' || catNorm === 'camisetas de time retro' || catNorm === 'camisetas-de-time-retro') {
        return pCat.includes('retrô') || pCat.includes('retro');
      }
      if (catNorm === 'sapatilhas de atletismo' || catNorm === 'sapatilhas-de-atletismo') {
        return pCat.includes('sapatilhas');
      }
      return pCat === catNorm || pCat.replace(/[^a-z0-9]+/g, '-') === catNorm;
    });
  }
  if (subcategory) {
    const subNorm = subcategory.toLowerCase().trim();
    list = list.filter(p => (p.subcategory || '').toLowerCase() === subNorm);
  }
  if (featured !== null) {
    list = list.filter(p => p.featured === featured);
  }
  if (search) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.category || '').toLowerCase().includes(search) ||
      (p.subcategory || '').toLowerCase().includes(search)
    );
  }

  if (sort === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'name-desc') list = [...list].sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === 'featured') list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  const total = list.length;
  const sliced = list.slice(offset, offset + limit);

  return {
    data: sliced,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL Pool
// ─────────────────────────────────────────────────────────────────────────────
let pool = null;
let isDbConnected = false;

function getPool() {
  const dbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
  if (!pool && dbUrl) {
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// DDL — Criação das tabelas e teste de conexão (idempotente)
// ─────────────────────────────────────────────────────────────────────────────
async function initDB() {
  const dbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
  if (!dbUrl) {
    console.warn('[DB] ℹ️ DATABASE_URL não configurada no ambiente. Aplicação operando com catálogo JSON em fallback.');
    return;
  }

  const db = getPool();
  if (!db) return;

  try {
    // Testa conectividade primeiro
    const client = await db.connect();
    client.release();
    isDbConnected = true;
    console.log('[DB] ✅ Conexão PostgreSQL estabelecida com sucesso.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id                SERIAL PRIMARY KEY,
        name              TEXT        NOT NULL,
        slug              TEXT        NOT NULL UNIQUE,
        category          TEXT        NOT NULL DEFAULT '',
        original_category TEXT        DEFAULT '',
        subcategory       TEXT        DEFAULT '',
        images            JSONB       NOT NULL DEFAULT '[]',
        source_url        TEXT        NOT NULL UNIQUE,
        source_provider   TEXT        DEFAULT 'yupoo',
        description       TEXT        DEFAULT '',
        published         BOOLEAN     NOT NULL DEFAULT false,
        featured          BOOLEAN     NOT NULL DEFAULT false,
        status            TEXT        NOT NULL DEFAULT 'draft',
        main_image_index  INTEGER     DEFAULT 0,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
      CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status);
      CREATE INDEX IF NOT EXISTS idx_products_featured    ON products(featured);
      CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug);
      CREATE INDEX IF NOT EXISTS idx_products_created_at  ON products(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_products_search ON products
        USING GIN(to_tsvector('portuguese',
          coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(subcategory,'')));

      CREATE TABLE IF NOT EXISTS store_settings (
        id                       SERIAL PRIMARY KEY,
        store_name               TEXT    DEFAULT 'LN SPORTS',
        whatsapp_number          TEXT    DEFAULT '5549998046866',
        whatsapp_enabled         BOOLEAN DEFAULT true,
        default_message          TEXT    DEFAULT '',
        product_message_template TEXT    DEFAULT '',
        instagram_url            TEXT    DEFAULT '',
        announcement_text        TEXT    DEFAULT '🚀 Catálogo Oficial LN SPORTS — Envio para todo o Brasil via Atendimento Exclusivo no WhatsApp',
        updated_at               TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS admins (
        id            SERIAL PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] Tabelas verificadas/criadas com sucesso.');

    // Migração leve e idempotente: coluna da capa oficial (foto do par).
    // Produtos antigos simplesmente ficam com '' até o backfill/import atualizar.
    try {
      await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cover_hash TEXT DEFAULT ''`);
    } catch (migErr) {
      console.warn('[DB] Aviso na migração cover_hash:', migErr.message);
    }

    // Seed do admin padrão se ADMIN_EMAIL e ADMIN_PASSWORD_HASH existirem
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
      await db.query(`
        INSERT INTO admins (email, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD_HASH]);
      console.log('[DB] Admin seed aplicado no PostgreSQL.');
    }
  } catch (err) {
    isDbConnected = false;
    console.warn(`[DB] ⚠️ Falha ao conectar ao PostgreSQL (${err.message}). Mantendo fallback do catálogo JSON.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'ln-sports-dev-secret-change-in-prod';

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  try {
    req.admin = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Converte row do DB para formato do frontend (camelCase)
function rowToProduct(row) {
  if (!row) return null;
  const rawCat = row.category || '';
  let publicCat = rawCat;
  const lowerCat = rawCat.toLowerCase().trim();
  if (lowerCat.startsWith('tênis casuais') || lowerCat.startsWith('tenis casuais')) {
    publicCat = 'Tênis Casuais';
  } else if (lowerCat.startsWith('tênis esportivos') || lowerCat.startsWith('tenis esportivos')) {
    publicCat = 'Tênis Esportivos';
  } else if (lowerCat.includes('chuteiras - infantil') || lowerCat === 'chuteiras infantil') {
    publicCat = 'Chuteiras Infantil';
  } else if (lowerCat.includes('chuteiras - 0') || lowerCat === 'chuteiras') {
    publicCat = 'Chuteiras';
  }

  const images = Array.isArray(row.images) ? row.images : (row.images || []);
  // Foto primária: índice gravado > capa oficial do álbum (foto do par) > 0.
  // Regra central em src/utils/coverUtils.js (mesma da loja e do backfill).
  const storedIndex = (row.main_image_index !== null && row.main_image_index !== undefined)
    ? row.main_image_index
    : (row.mainImageIndex !== null && row.mainImageIndex !== undefined ? row.mainImageIndex : null);
  const mainImageIndex = resolveCoverIndex(
    { images, coverHash: row.cover_hash || row.coverHash || null },
    Number.isInteger(storedIndex) ? storedIndex : null
  );

  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    category: publicCat,
    originalCategory: row.original_category || row.category,
    subcategory: '',
    images: images,
    coverHash: row.cover_hash || row.coverHash || null,
    sourceUrl: row.source_url,
    sourceProvider: row.source_provider || 'yupoo',
    description: row.description || '',
    published: row.published,
    featured: row.featured,
    status: row.status,
    mainImageIndex: mainImageIndex,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// /api/image-proxy — MANTIDO INTACTO
// ─────────────────────────────────────────────────────────────────────────────
async function imageProxyHandler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) { res.status(400).send('Missing url parameter'); return; }
  let targetParsed;
  try { targetParsed = new URL(targetUrl); } catch {
    res.status(400).send('Invalid url parameter'); return;
  }
  if (!targetParsed.hostname.includes('yupoo.com')) {
    res.status(403).send('Only yupoo.com images are allowed'); return;
  }
  const account = targetParsed.pathname.split('/').filter(Boolean)[0] || 'minkang';
  try {
    const upstream = await fetch(targetUrl, {
      headers: buildYupooProxyHeaders(account)
    });
    if (!upstream.ok) { res.status(upstream.status).send(`Upstream error: ${upstream.status}`); return; }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (isYupooPlaceholder(buffer)) { res.status(404).send('Yupoo placeholder (foto removida pelo Yupoo)'); return; }
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
app.get('/api/image-proxy', imageProxyHandler);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  const db = getPool();
  if (!db || !isDbConnected) {
    return res.json(queryMemoryProducts(req));
  }

  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    const offset   = (page - 1) * limit;
    const category    = req.query.category    || null;
    const subcategory = req.query.subcategory || null;
    const status      = req.query.status      || null;   // 'published', 'draft', 'all' ou null
    const search      = req.query.search      || null;
    const sort        = req.query.sort        || 'newest';
    const featured    = req.query.featured !== undefined ? req.query.featured === 'true' : null;

    const conditions = [];
    const params = [];
    let pi = 1;

    // Status filter — se status='all' ou null, não filtra
    if (status && status !== 'all') {
      conditions.push(`status = $${pi++}`);
      params.push(status);
    }
    if (category) {
      const catLower = category.toLowerCase().trim();
      if (catLower === 'tênis casuais' || catLower === 'tenis casuais' || catLower === 'tenis-casuais') {
        conditions.push(`(lower(category) = 'tênis casuais' OR lower(category) = 'tenis casuais' OR lower(category) LIKE 'tênis casuais%' OR lower(category) LIKE 'tenis casuais%')`);
      } else if (catLower === 'tênis esportivos' || catLower === 'tenis esportivos' || catLower === 'tenis-esportivos') {
        conditions.push(`(lower(category) = 'tênis esportivos' OR lower(category) = 'tenis esportivos' OR lower(category) LIKE 'tênis esportivos%' OR lower(category) LIKE 'tenis esportivos%')`);
      } else if (catLower === 'chuteiras' || catLower === 'chuteira') {
        conditions.push(`(lower(category) = 'chuteiras' OR lower(category) LIKE '%chuteiras - 0%')`);
      } else if (catLower === 'chuteiras infantil' || catLower === 'chuteiras-infantil' || catLower === 'chuteira infantil') {
        conditions.push(`(lower(category) = 'chuteiras infantil' OR lower(category) LIKE '%chuteiras - infantil%')`);
      } else if (catLower === 'tênis on running e hoka' || catLower === 'tenis on running e hoka' || catLower === 'tenis-on-running-e-hoka') {
        conditions.push(`(lower(category) = 'tênis on running e hoka' OR lower(category) = 'tenis on running e hoka')`);
      } else if (catLower === 'camisetas de time' || catLower === 'camisetas-de-time') {
        conditions.push(`lower(category) = 'camisetas de time'`);
      } else if (catLower === 'camisetas de time retrô' || catLower === 'camisetas de time retro' || catLower === 'camisetas-de-time-retro') {
        conditions.push(`(lower(category) = 'camisetas de time retrô' OR lower(category) = 'camisetas de time retro')`);
      } else if (catLower === 'sapatilhas de atletismo' || catLower === 'sapatilhas-de-atletismo') {
        conditions.push(`lower(category) = 'sapatilhas de atletismo'`);
      } else {
        conditions.push(`lower(category) = lower($${pi++})`);
        params.push(category);
      }
    }
    if (subcategory) {
      conditions.push(`lower(subcategory) = lower($${pi++})`);
      params.push(subcategory);
    }
    if (featured !== null) {
      conditions.push(`featured = $${pi++}`);
      params.push(featured);
    }
    if (search) {
      conditions.push(`to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(subcategory,'')) @@ plainto_tsquery('portuguese', $${pi++})`);
      params.push(search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Ordenação
    let orderBy = 'ORDER BY created_at DESC';
    if (sort === 'name-asc')  orderBy = 'ORDER BY name ASC';
    if (sort === 'name-desc') orderBy = 'ORDER BY name DESC';
    if (sort === 'featured')  orderBy = 'ORDER BY featured DESC, created_at DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM products ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT * FROM products ${where} ${orderBy} LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: dataResult.rows.map(rowToProduct),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.warn('[API] Falha no PostgreSQL em /api/products, usando fallback do catálogo JSON:', err.message);
    return res.json(queryMemoryProducts(req));
  }
});

app.get('/api/products/:slug', async (req, res) => {
  const db = getPool();
  if (!db || !isDbConnected) {
    const list = getMemoryProducts();
    const product = list.find(p => p.slug === req.params.slug || (p.sourceUrl && p.sourceUrl.includes(req.params.slug)));
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(product);
  }

  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE slug = $1 LIMIT 1',
      [req.params.slug]
    );
    if (!rows.length) {
      const list = getMemoryProducts();
      const product = list.find(p => p.slug === req.params.slug || (p.sourceUrl && p.sourceUrl.includes(req.params.slug)));
      if (product) return res.json(product);
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.warn('[API] Falha no PostgreSQL em /api/products/:slug, usando fallback em memória:', err.message);
    const list = getMemoryProducts();
    const product = list.find(p => p.slug === req.params.slug || (p.sourceUrl && p.sourceUrl.includes(req.params.slug)));
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    return res.json(product);
  }
});

app.get('/api/products/:slug/related', async (req, res) => {
  const db = getPool();
  if (!db || !isDbConnected) {
    const list = getMemoryProducts();
    const product = list.find(p => p.slug === req.params.slug);
    if (!product) return res.json([]);
    const limit = Math.min(12, parseInt(req.query.limit) || 4);
    const related = list.filter(p => p.category === product.category && p.slug !== product.slug).slice(0, limit);
    return res.json(related);
  }

  try {
    const product = (await db.query('SELECT * FROM products WHERE slug = $1 LIMIT 1', [req.params.slug])).rows[0];
    if (!product) return res.json([]);
    const limit = Math.min(12, parseInt(req.query.limit) || 4);
    const { rows } = await db.query(
      `SELECT * FROM products WHERE lower(category) = lower($1) AND slug != $2 ORDER BY created_at DESC LIMIT $3`,
      [product.category, req.params.slug, limit]
    );
    res.json(rows.map(rowToProduct));
  } catch (err) {
    console.warn('[API] Falha no PostgreSQL em /api/products/:slug/related, usando fallback em memória:', err.message);
    const list = getMemoryProducts();
    const product = list.find(p => p.slug === req.params.slug);
    if (!product) return res.json([]);
    const limit = Math.min(12, parseInt(req.query.limit) || 4);
    const related = list.filter(p => p.category === product.category && p.slug !== product.slug).slice(0, limit);
    return res.json(related);
  }
});

// GET /api/categories
// Retorna categorias fixas com contagem real de produtos do banco
app.get('/api/categories', async (req, res) => {
  const db = getPool();

  const OFFICIAL_CATEGORIES = [
    { id: 'camisetas-de-time',          name: 'Camisetas de Time',                   slug: 'camisetas-de-time' },
    { id: 'camisetas-de-time-retro',    name: 'Camisetas de Time Retrô',            slug: 'camisetas-de-time-retro' },
    { id: 'chuteiras',                  name: 'Chuteiras',                           slug: 'chuteiras' },
    { id: 'chuteiras-infantil',         name: 'Chuteiras Infantil',                  slug: 'chuteiras-infantil' },
    { id: 'sapatilhas-de-atletismo',    name: 'Sapatilhas de Atletismo',             slug: 'sapatilhas-de-atletismo' },
    { id: 'tenis-casuais',              name: 'Tênis Casuais',                      slug: 'tenis-casuais' },
    { id: 'tenis-on-running-e-hoka',    name: 'Tênis On Running e HOKA',             slug: 'tenis-on-running-e-hoka' },
    { id: 'tenis-esportivos',           name: 'Tênis Esportivos',                    slug: 'tenis-esportivos' },
  ];

  // Aliases: nome no DB (lower) -> nome oficial da categoria
  const CATEGORY_DB_ALIASES = {
    'tênis casuais - senha: hjh001077': 'Tênis Casuais',
    'tênis esportivos - senha: 888888':  'Tênis Esportivos',
    'catálogo de chuteiras - 01': 'Chuteiras',
    'catálogo de chuteiras - 02': 'Chuteiras',
    'catálogo de chuteiras - 03': 'Chuteiras',
    'catalogo de chuteiras - 01': 'Chuteiras',
    'catalogo de chuteiras - 02': 'Chuteiras',
    'catalogo de chuteiras - 03': 'Chuteiras',
    'catálogo de chuteiras - infantil': 'Chuteiras Infantil',
    'catalogo de chuteiras - infantil': 'Chuteiras Infantil',
  };

  function getMemoryCategories() {
    const list = getMemoryProducts();
    const countMap = {};
    for (const p of list) {
      let cat = (p.category || '').toLowerCase();
      if (cat.startsWith('tênis casuais') || cat.startsWith('tenis casuais')) cat = 'tênis casuais';
      else if (cat.startsWith('tênis esportivos') || cat.startsWith('tenis esportivos')) cat = 'tênis esportivos';
      countMap[cat] = (countMap[cat] || 0) + 1;
    }
    return OFFICIAL_CATEGORIES.map(c => {
      const key = c.name.toLowerCase();
      return {
        ...c,
        productCount: countMap[key] || 0,
        subcategories: [],
      };
    });
  }

  if (!db || !isDbConnected) {
    return res.json(getMemoryCategories());
  }

  try {
    // Contagem por categoria
    const countResult = await db.query(
      `SELECT lower(category) as cat, COUNT(*) as cnt FROM products GROUP BY lower(category)`
    );
    const countMap = {};
    for (const r of countResult.rows) {
      // Remapeia aliases (categorias com senha) para o nome público
      const publicName = CATEGORY_DB_ALIASES[r.cat] || null;
      const key = publicName ? publicName.toLowerCase() : r.cat;
      countMap[key] = (countMap[key] || 0) + parseInt(r.cnt);
    }

    const categories = OFFICIAL_CATEGORIES.map(cat => {
      const key = cat.name.toLowerCase();
      return {
        ...cat,
        productCount: countMap[key] || 0,
        subcategories: [],
      };
    });

    res.json(categories);
  } catch (err) {
    console.warn('[API] Falha no PostgreSQL em /api/categories, usando fallback do catálogo JSON:', err.message);
    res.json(getMemoryCategories());
  }
});

// GET /api/settings
app.get('/api/settings', async (req, res) => {
  const db = getPool();
  const DEFAULT = {
    storeName: process.env.VITE_STORE_NAME || 'LN SPORTS',
    whatsappNumber: process.env.VITE_STORE_WHATSAPP_NUMBER || '5549998046866',
    whatsappEnabled: true,
    defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
    productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações com um atendente.',
    instagramUrl: process.env.VITE_STORE_INSTAGRAM_URL || 'https://www.instagram.com/ln.sportsss/',
    announcementText: '🚀 Catálogo Oficial LN SPORTS — Envio para todo o Brasil via Atendimento Exclusivo no WhatsApp',
  };
  if (!db) return res.json(DEFAULT);
  try {
    const { rows } = await db.query('SELECT * FROM store_settings WHERE id = 1');
    if (!rows.length) return res.json(DEFAULT);
    const r = rows[0];
    res.json({
      storeName: r.store_name || DEFAULT.storeName,
      whatsappNumber: r.whatsapp_number || DEFAULT.whatsappNumber,
      whatsappEnabled: r.whatsapp_enabled !== false,
      defaultMessage: r.default_message || DEFAULT.defaultMessage,
      productMessageTemplate: r.product_message_template || DEFAULT.productMessageTemplate,
      instagramUrl: r.instagram_url || DEFAULT.instagramUrl,
      announcementText: r.announcement_text || DEFAULT.announcementText,
    });
  } catch (err) {
    console.error('[API] GET /api/settings error:', err.message);
    res.json(DEFAULT);
  }
});

// GET /api/image-proxy — Proxy de imagens Yupoo com suporte a bypass de hotlinking e cache
app.get('/api/image-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  let targetParsed;
  try {
    targetParsed = new URL(targetUrl);
  } catch {
    return res.status(400).send('Invalid url parameter');
  }

  if (!targetParsed.hostname.includes('yupoo.com')) {
    return res.status(403).send('Only yupoo.com images are allowed');
  }

  const pathParts = targetParsed.pathname.split('/').filter(Boolean);
  const account = pathParts[0] || 'minkang';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: buildYupooProxyHeaders(account)
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      // Tenta novamente com referer genérico (mantendo o cookie de senha)
      const retryHeaders = {
        'Referer': 'https://x.yupoo.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8'
      };
      const retryCookie = getYupooCookie(account);
      if (retryCookie) retryHeaders['Cookie'] = retryCookie;
      const retryUpstream = await fetch(targetUrl, {
        headers: retryHeaders
      });
      if (retryUpstream.ok) {
        const contentType = retryUpstream.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        const buf = Buffer.from(await retryUpstream.arrayBuffer());
        res.setHeader('Content-Length', buf.length);
        return res.end(buf);
      }
      return res.status(upstream.status).send(`Upstream error: ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (isYupooPlaceholder(buffer)) {
      return res.status(404).send('Yupoo placeholder (foto removida pelo Yupoo)');
    }
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('[Image Proxy Error]:', err.message);
    res.status(500).send('Failed to proxy image');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN API (protegida por JWT)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  const normEmail = (email || '').trim().toLowerCase();
  const db = getPool();

  // 1. Tenta autenticar pelo banco se o DB estiver conectado
  if (db && isDbConnected) {
    try {
      const { rows } = await db.query('SELECT * FROM admins WHERE lower(email) = lower($1) LIMIT 1', [normEmail]);
      if (rows.length) {
        const admin = rows[0];
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (valid) {
          const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
          return res.json({ token, email: admin.email });
        }
      }
    } catch (err) {
      console.warn('[API] Falha ao consultar admin no DB, tentando variáveis de ambiente:', err.message);
    }
  }

  // 2. Valida com a variável de ambiente segura (bcrypt hash)
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH;

  if (adminEmail && adminHash && normEmail === adminEmail) {
    const match = await bcrypt.compare(password, adminHash).catch(() => false);
    if (match) {
      const token = jwt.sign({ email: process.env.ADMIN_EMAIL, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, email: process.env.ADMIN_EMAIL });
    }
  }

  return res.status(401).json({ error: 'Credenciais inválidas' });
});

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
  const db = getPool();
  function getMemoryDashboard() {
    const list = getMemoryProducts();
    return {
      total: list.length,
      published: list.filter(p => p.status === 'published').length,
      draft: list.filter(p => p.status === 'draft').length,
      inactive: list.filter(p => p.status === 'inactive').length,
      featured: list.filter(p => p.featured).length,
      categoriesCount: 8,
      withoutImages: list.filter(p => !p.images || !p.images.length).length,
      withoutDescription: list.filter(p => !p.description).length,
    };
  }

  if (!db || !isDbConnected) {
    return res.json(getMemoryDashboard());
  }

  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE featured = true) as featured,
        COUNT(*) FILTER (WHERE images = '[]' OR images IS NULL) as without_images,
        COUNT(*) FILTER (WHERE description = '' OR description IS NULL) as without_description,
        COUNT(DISTINCT lower(category)) as categories_count
      FROM products
    `);
    const r = rows[0];
    res.json({
      total: parseInt(r.total),
      published: parseInt(r.published),
      draft: parseInt(r.draft),
      inactive: parseInt(r.inactive),
      featured: parseInt(r.featured),
      categoriesCount: parseInt(r.categories_count),
      withoutImages: parseInt(r.without_images),
      withoutDescription: parseInt(r.without_description),
    });
  } catch (err) {
    console.warn('[API] Falha no PostgreSQL em /api/admin/dashboard, usando fallback do catálogo JSON:', err.message);
    res.json(getMemoryDashboard());
  }
});

// PUT /api/admin/products/:id — Editar produto completo
app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
  try {
    const { name, slug, category, subcategory, images, description, status, featured, mainImageIndex } = req.body;
    const { rows } = await db.query(`
      UPDATE products SET
        name = COALESCE($1, name),
        slug = COALESCE($2, slug),
        category = COALESCE($3, category),
        subcategory = COALESCE($4, subcategory),
        images = COALESCE($5, images),
        description = COALESCE($6, description),
        status = COALESCE($7, status),
        published = COALESCE($8, published),
        featured = COALESCE($9, featured),
        main_image_index = COALESCE($10, main_image_index),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      name, slug, category, subcategory,
      images ? JSON.stringify(images) : null,
      description,
      status,
      status ? status === 'published' : null,
      featured !== undefined ? featured : null,
      mainImageIndex !== undefined ? mainImageIndex : null,
      req.params.id
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] PUT /api/admin/products/:id error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/admin/products/:id/publish — Toggle status
app.patch('/api/admin/products/:id/publish', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
  try {
    const { rows } = await db.query(
      `UPDATE products SET
         status = CASE WHEN status = 'published' THEN 'draft' ELSE 'published' END,
         published = CASE WHEN status = 'published' THEN false ELSE true END,
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] PATCH .../publish error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/admin/products/:id/featured — Toggle featured
app.patch('/api/admin/products/:id/featured', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
  try {
    const { rows } = await db.query(
      `UPDATE products SET featured = NOT featured, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] PATCH .../featured error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/admin/products/:id/main-image — Salvar índice da imagem principal
app.patch('/api/admin/products/:id/main-image', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
  try {
    const { index } = req.body;
    const { rows } = await db.query(
      `UPDATE products SET main_image_index = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [index || 0, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] PATCH .../main-image error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/admin/products/:id/cover — Definir imagem existente como capa (images[0])
app.patch('/api/admin/products/:id/cover', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) {
    const list = getMemoryProducts();
    const prod = list.find(p => String(p.id) === String(req.params.id) || p.slug === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Produto não encontrado' });
    const { images, coverIndex } = req.body || {};
    if (images && Array.isArray(images)) {
      prod.images = images;
    } else if (coverIndex !== undefined && Array.isArray(prod.images) && prod.images[coverIndex]) {
      const chosen = prod.images[coverIndex];
      prod.images = [chosen, ...prod.images.filter((_, i) => i !== coverIndex)];
    }
    prod.mainImageIndex = 0;
    return res.json(prod);
  }
  try {
    const { images, coverIndex } = req.body || {};
    let newImages = images;

    if (!newImages && coverIndex !== undefined) {
      const current = await db.query('SELECT images FROM products WHERE id = $1', [req.params.id]);
      if (current.rows.length) {
        const raw = current.rows[0].images || [];
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(arr) && arr[coverIndex]) {
          const chosen = arr[coverIndex];
          newImages = [chosen, ...arr.filter((_, i) => i !== coverIndex)];
        }
      }
    }

    const { rows } = await db.query(
      `UPDATE products SET images = COALESCE($1, images), main_image_index = 0, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newImages ? JSON.stringify(newImages) : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] PATCH .../cover error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/admin/settings — Salvar configurações da loja
app.put('/api/admin/settings', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
  try {
    const { storeName, whatsappNumber, whatsappEnabled, defaultMessage, productMessageTemplate, instagramUrl, announcementText } = req.body;
    await db.query(`
      UPDATE store_settings SET
        store_name               = COALESCE($1, store_name),
        whatsapp_number          = COALESCE($2, whatsapp_number),
        whatsapp_enabled         = COALESCE($3, whatsapp_enabled),
        default_message          = COALESCE($4, default_message),
        product_message_template = COALESCE($5, product_message_template),
        instagram_url            = COALESCE($6, instagram_url),
        announcement_text        = COALESCE($7, announcement_text),
        updated_at               = NOW()
      WHERE id = 1
    `, [storeName, whatsappNumber, whatsappEnabled, defaultMessage, productMessageTemplate, instagramUrl, announcementText]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[API] PUT /api/admin/settings error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/admin/categories — Salvar/atualizar dados da categoria (idempotente)
app.put('/api/admin/categories', requireAuth, async (req, res) => {
  const { name, slug, subcategories, productCount } = req.body || {};
  res.json({ ok: true, name, slug, subcategories, productCount });
});

// ─────────────────────────────────────────────────────────────────────────────
// Static + SPA Fallback
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`🗄️  PostgreSQL: ${isDbConnected ? '✅ Conectado como banco principal' : '⚠️  DATABASE_URL não configurada ou inacessível — catálogo JSON ativo em fallback'}`);
  });
});
