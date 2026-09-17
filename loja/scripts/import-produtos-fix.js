#!/usr/bin/env node
/**
 * import-produtos-fix.js
 * Importa 25.207 produtos com slugs garantidamente únicos e datas seguras.
 * UPSERT por source_url. Não altera produtos.json.
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL nao definida.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function ensureSchema(client) {
  await client.query(`
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
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_featured    ON products(featured)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_products_created_at  ON products(created_at DESC)`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_products_search ON products
      USING GIN(to_tsvector('portuguese',
        coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(subcategory,'')))
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id                       SERIAL PRIMARY KEY,
      store_name               TEXT    DEFAULT 'LN SPORTS',
      whatsapp_number          TEXT    DEFAULT '5549998046866',
      whatsapp_enabled         BOOLEAN DEFAULT true,
      default_message          TEXT    DEFAULT '',
      product_message_template TEXT    DEFAULT '',
      instagram_url            TEXT    DEFAULT '',
      announcement_text        TEXT    DEFAULT 'Catalogo Oficial LN SPORTS',
      updated_at               TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Schema OK.');
}

function safeDate(val) {
  if (!val) return new Date();
  if (typeof val === 'string') {
    val = val.replace(/\+00:00Z$/, 'Z').replace(/Z\+00:00$/, 'Z');
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeSlug(text) {
  if (!text) return 'produto-sem-nome';
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'produto';
}

async function upsertBatch(client, rows) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const values = [];
  const placeholders = rows.map((row, i) => {
    const base = i * 15;
    values.push(
      row.name, row.slug, row.category, row.original_category, row.subcategory,
      row.images, row.source_url, row.source_provider, row.description,
      row.published, row.featured, row.status, row.main_image_index,
      row.created_at, row.updated_at
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15})`;
  });
  const sql = `
    INSERT INTO products
      (name, slug, category, original_category, subcategory, images,
       source_url, source_provider, description, published, featured, status,
       main_image_index, created_at, updated_at)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (source_url) DO UPDATE SET
      name              = EXCLUDED.name,
      slug              = products.slug,
      category          = EXCLUDED.category,
      original_category = EXCLUDED.original_category,
      subcategory       = EXCLUDED.subcategory,
      images            = EXCLUDED.images,
      source_provider   = EXCLUDED.source_provider,
      description       = CASE WHEN EXCLUDED.description != '' THEN EXCLUDED.description ELSE products.description END,
      published         = EXCLUDED.published,
      featured          = EXCLUDED.featured,
      status            = EXCLUDED.status,
      updated_at        = EXCLUDED.updated_at
    RETURNING (xmax = 0) AS inserted
  `;
  const result = await client.query(sql, values);
  const inserted = result.rows.filter(r => r.inserted).length;
  return { inserted, updated: result.rows.length - inserted };
}

async function main() {
  const lojaDir = path.resolve(__dirname, '..');
  const jsonPath = path.join(lojaDir, 'src', 'data', 'produtos.json');
  console.log('Lendo: ' + jsonPath);
  let produtos;
  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    produtos = JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler produtos.json:', err.message);
    process.exit(1);
  }
  if (!Array.isArray(produtos)) { console.error('Nao e array.'); process.exit(1); }
  const total = produtos.length;
  console.log('Total no JSON: ' + total);

  const client = await pool.connect();
  try {
    await ensureSchema(client);

    // Carrega slugs e source_urls existentes no banco
    const existing = await client.query('SELECT source_url, slug FROM products');
    const existingByUrl = new Map();
    const usedSlugs = new Set();
    for (const r of existing.rows) {
      existingByUrl.set(r.source_url, r.slug);
      usedSlugs.add(r.slug);
    }
    console.log('Produtos ja no banco: ' + existing.rows.length);

    const BATCH = 200;
    let totalInserted = 0, totalUpdated = 0, totalSkipped = 0;
    const startTime = Date.now();

    // Pre-gera slugs unicos para todos os produtos
    const rows = [];
    for (let i = 0; i < total; i++) {
      const p = produtos[i];
      if (!p || !p.sourceUrl || !p.name) { totalSkipped++; continue; }

      let slug;
      if (existingByUrl.has(p.sourceUrl)) {
        // Produto ja existe: usa o slug que ja esta no banco
        slug = existingByUrl.get(p.sourceUrl);
      } else if (p.slug && !usedSlugs.has(p.slug)) {
        slug = p.slug.slice(0, 200);
        usedSlugs.add(slug);
      } else {
        let base = normalizeSlug(p.name);
        let candidate = base;
        let counter = i;
        while (usedSlugs.has(candidate)) {
          candidate = base.slice(0, 70) + '-' + counter;
          counter++;
        }
        slug = candidate.slice(0, 200);
        usedSlugs.add(slug);
      }

      rows.push({
        name:              (p.name || '').slice(0, 500),
        slug,
        category:          (p.category || '').slice(0, 200),
        original_category: (p.originalCategory || p.category || '').slice(0, 200),
        subcategory:       (p.subcategory || '').slice(0, 200),
        images:            JSON.stringify(Array.isArray(p.images) ? p.images : []),
        source_url:        (p.sourceUrl || '').slice(0, 1000),
        source_provider:   (p.sourceProvider || 'yupoo').slice(0, 100),
        description:       (p.description || '').slice(0, 5000),
        published:         p.published !== false,
        featured:          Boolean(p.featured),
        status:            (p.status || 'draft').slice(0, 50),
        main_image_index:  Number(p.mainImageIndex) || 0,
        created_at:        safeDate(p.createdAt),
        updated_at:        safeDate(p.updatedAt),
      });
    }

    console.log('Rows preparados: ' + rows.length);

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      try {
        const { inserted, updated } = await upsertBatch(client, slice);
        totalInserted += inserted;
        totalUpdated  += updated;
      } catch (err) {
        console.warn('Erro no lote ' + i + ': ' + err.message.slice(0, 120));
        for (const row of slice) {
          try {
            const { inserted, updated } = await upsertBatch(client, [row]);
            totalInserted += inserted;
            totalUpdated  += updated;
          } catch (e2) {
            console.warn('Pulando ' + row.name.slice(0,50) + ': ' + e2.message.slice(0,80));
            totalSkipped++;
          }
        }
      }
      const done = Math.min(i + BATCH, rows.length);
      process.stdout.write('\r[' + done + '/' + rows.length + '] ' + ((done/rows.length)*100).toFixed(1) + '%');
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n');
    console.log('=== IMPORTACAO CONCLUIDA em ' + elapsed + 's ===');
    console.log('Inseridos  : ' + totalInserted);
    console.log('Atualizados: ' + totalUpdated);
    console.log('Ignorados  : ' + totalSkipped);
    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM products');
    console.log('Total no banco: ' + parseInt(countRows[0].count));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Erro fatal:', err); process.exit(1); });
