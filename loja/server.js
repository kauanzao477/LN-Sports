import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL Pool
// ─────────────────────────────────────────────────────────────────────────────
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
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
// DDL — Criação das tabelas (idempotente)
// ─────────────────────────────────────────────────────────────────────────────
async function initDB() {
  const db = getPool();
  if (!db) {
    console.warn('[DB] DATABASE_URL não definida — rodando sem PostgreSQL.');
    return;
  }
  try {
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
        whatsapp_number          TEXT    DEFAULT '5511999999999',
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

    // Seed do admin padrão se ADMIN_EMAIL e ADMIN_PASSWORD_HASH existirem
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
      await db.query(`
        INSERT INTO admins (email, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `, [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD_HASH]);
      console.log('[DB] Admin seed aplicado.');
    }
  } catch (err) {
    console.error('[DB] Erro ao inicializar schema:', err.message);
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
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    category: row.category,
    originalCategory: row.original_category || row.category,
    subcategory: row.subcategory || '',
    images: Array.isArray(row.images) ? row.images : (row.images || []),
    sourceUrl: row.source_url,
    sourceProvider: row.source_provider || 'yupoo',
    description: row.description || '',
    published: row.published,
    featured: row.featured,
    status: row.status,
    mainImageIndex: row.main_image_index || 0,
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
  const referer = `https://${account}.x.yupoo.com/`;
  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });
    if (!upstream.ok) { res.status(upstream.status).send(`Upstream error: ${upstream.status}`); return; }
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
app.get('/api/image-proxy', imageProxyHandler);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/products
// Query params: page, limit, category, subcategory, status, search, sort, featured
app.get('/api/products', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });

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
      conditions.push(`lower(category) = lower($${pi++})`);
      params.push(category);
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
    console.error('[API] GET /api/products error:', err.message);
    res.status(500).json({ error: 'Erro interno ao buscar produtos' });
  }
});

// GET /api/products/:slug
app.get('/api/products/:slug', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM products WHERE slug = $1 LIMIT 1',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rowToProduct(rows[0]));
  } catch (err) {
    console.error('[API] GET /api/products/:slug error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/products/:slug/related
app.get('/api/products/:slug/related', async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });

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
    console.error('[API] GET /api/products/:slug/related error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/categories
// Retorna categorias fixas com contagem real de produtos do banco
app.get('/api/categories', async (req, res) => {
  const db = getPool();

  const OFFICIAL_CATEGORIES = [
    { id: 'camisetas-de-time-retro',    name: 'Camisetas de Time Retrô',            slug: 'camisetas-de-time-retro' },
    { id: 'sapatilhas-de-atletismo',    name: 'Sapatilhas de Atletismo',             slug: 'sapatilhas-de-atletismo' },
    { id: 'chuteiras',                  name: 'Chuteiras',                           slug: 'chuteiras' },
    { id: 'chuteiras-infantil',         name: 'Chuteiras Infantil',                  slug: 'chuteiras-infantil' },
    { id: 'tabela-de-conversao-br-x-eur', name: 'Tabela de Conversão BR x EUR',     slug: 'tabela-de-conversao-br-x-eur' },
    { id: 'camisetas-de-time',          name: 'Camisetas de Time',                   slug: 'camisetas-de-time' },
    { id: 'tenis-de-corrida',           name: 'Tênis de Corrida',                    slug: 'tenis-de-corrida' },
    { id: 'tenis-esportivo',            name: 'Tênis Esportivo',                     slug: 'tenis-esportivo' },
    { id: 'tenis-on-running-e-hoka',    name: 'Tênis On Running e HOKA',             slug: 'tenis-on-running-e-hoka' },
    { id: 'tenis-casuais',              name: 'Tênis Casuais',                      slug: 'tenis-casuais' },
    { id: 'tenis-esportivos',           name: 'Tênis Esportivos',                    slug: 'tenis-esportivos' },
  ];

  // Aliases: nome no DB (lower) -> nome oficial da categoria
  const CATEGORY_DB_ALIASES = {
    'tênis casuais - senha: hjh001077': 'Tênis Casuais',
    'tênis esportivos - senha: 888888':  'Tênis Esportivos',
  };

  if (!db) {
    return res.json(OFFICIAL_CATEGORIES.map(c => ({ ...c, productCount: 0, subcategories: [] })));
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

    // Subcategorias por categoria
    const subResult = await db.query(
      `SELECT lower(category) as cat, subcategory FROM products WHERE subcategory IS NOT NULL AND subcategory != '' GROUP BY lower(category), subcategory ORDER BY subcategory`
    );
    const subMap = {};
    for (const r of subResult.rows) {
      const publicName = CATEGORY_DB_ALIASES[r.cat] || null;
      const key = publicName ? publicName.toLowerCase() : r.cat;
      if (!subMap[key]) subMap[key] = new Set();
      subMap[key].add(r.subcategory);
    }

    const categories = OFFICIAL_CATEGORIES.map(cat => {
      const key = cat.name.toLowerCase();
      return {
        ...cat,
        productCount: countMap[key] || 0,
        subcategories: subMap[key] ? Array.from(subMap[key]).sort() : [],
      };
    });

    res.json(categories);
  } catch (err) {
    console.error('[API] GET /api/categories error:', err.message);
    res.json(OFFICIAL_CATEGORIES.map(c => ({ ...c, productCount: 0, subcategories: [] })));
  }
});

// GET /api/settings
app.get('/api/settings', async (req, res) => {
  const db = getPool();
  const DEFAULT = {
    storeName: process.env.VITE_STORE_NAME || 'LN SPORTS',
    whatsappNumber: process.env.VITE_STORE_WHATSAPP_NUMBER || '5511999999999',
    whatsappEnabled: true,
    defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
    productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações com um atendente.',
    instagramUrl: 'https://instagram.com/lnsports',
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN API (protegida por JWT)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  const db = getPool();

  // Fallback demo quando DB não configurado
  if (!db) {
    if (email.toLowerCase().includes('admin') && password.length >= 6) {
      const token = jwt.sign({ email, role: 'admin', demo: true }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, email, demo: true });
    }
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM admins WHERE email = $1 LIMIT 1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, email: admin.email });
  } catch (err) {
    console.error('[API] POST /api/admin/login error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/admin/dashboard
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: 'Banco não configurado' });
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
    console.error('[API] GET /api/admin/dashboard error:', err.message);
    res.status(500).json({ error: 'Erro interno' });
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
    console.log(`🗄️  PostgreSQL: ${process.env.DATABASE_URL ? '✅ conectado' : '⚠️  sem DATABASE_URL (modo sem DB)'}`);
  });
});
