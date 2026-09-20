#!/usr/bin/env node
/**
 * import-produtos.js
 * Importa os 25.207 produtos de loja/src/data/produtos.json para PostgreSQL.
 *
 * Uso:
 *   node loja/scripts/import-produtos.js
 *   (requer DATABASE_URL no ambiente ou num arquivo .env na pasta loja/)
 *
 * Características:
 *   - UPSERT (ON CONFLICT source_url DO UPDATE) — nunca duplica
 *   - Lotes de 500 produtos por vez — não estoura memória
 *   - Cria as tabelas se não existirem
 *   - produtos.json NÃO é alterado
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Configuração ─────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL não definida. Crie um arquivo loja/.env com:');
  console.error('    DATABASE_URL=postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ── DDL idempotente ───────────────────────────────────────────────────────────
async function ensureSchema(client) {
  console.log('🗄️  Verificando/criando schema...');
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
  await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cover_hash TEXT DEFAULT ''`);
  console.log('✅  Schema OK.\n');
}

// ── Normaliza um produto do JSON para o formato do banco ─────────────────────
function normalizeSlug(text) {
  if (!text) return 'produto-sem-nome';
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[-\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'produto';
}

function toRow(p, index) {
  const slug = p.slug || normalizeSlug(p.name);
  // Garante unicidade do slug quando já existir outro com o mesmo nome
  const uniqueSlug = p.slug ? slug : `${slug}-${index}`;
  return {
    name:              (p.name || '').slice(0, 500),
    slug:              (p.slug || uniqueSlug).slice(0, 200),
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
    cover_hash:        (p.coverHash || '').slice(0, 100),
    created_at:        p.createdAt ? new Date(p.createdAt) : new Date(),
    updated_at:        p.updatedAt ? new Date(p.updatedAt) : new Date(),
  };
}

// ── UPSERT em lote ────────────────────────────────────────────────────────────
async function upsertBatch(client, rows) {
  if (!rows.length) return { inserted: 0, updated: 0 };

  // Monta VALUES dinâmico
  const values = [];
  const placeholders = rows.map((row, i) => {
    const base = i * 16;
    values.push(
      row.name, row.slug, row.category, row.original_category, row.subcategory,
      row.images, row.source_url, row.source_provider, row.description,
      row.published, row.featured, row.status, row.main_image_index,
      row.cover_hash, row.created_at, row.updated_at
    );
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16})`;
  });

  const sql = `
    INSERT INTO products
      (name, slug, category, original_category, subcategory, images,
       source_url, source_provider, description, published, featured, status,
       main_image_index, cover_hash, created_at, updated_at)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (source_url) DO UPDATE SET
      name              = EXCLUDED.name,
      slug              = EXCLUDED.slug,
      category          = EXCLUDED.category,
      original_category = EXCLUDED.original_category,
      subcategory       = EXCLUDED.subcategory,
      images            = EXCLUDED.images,
      source_provider   = EXCLUDED.source_provider,
      description       = CASE WHEN EXCLUDED.description != '' THEN EXCLUDED.description ELSE products.description END,
      published         = EXCLUDED.published,
      featured          = EXCLUDED.featured,
      status            = EXCLUDED.status,
      main_image_index  = EXCLUDED.main_image_index,
      cover_hash        = EXCLUDED.cover_hash,
      updated_at        = EXCLUDED.updated_at
    RETURNING (xmax = 0) AS inserted
  `;

  const result = await client.query(sql, values);
  const inserted = result.rows.filter(r => r.inserted).length;
  return { inserted, updated: result.rows.length - inserted };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const jsonPath = path.resolve(__dirname, '..', 'src', 'data', 'produtos.json');
  console.log(`📂  Lendo ${jsonPath}...`);

  let produtos;
  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    produtos = JSON.parse(raw);
  } catch (err) {
    console.error('❌  Erro ao ler produtos.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(produtos)) {
    console.error('❌  produtos.json não é um array.');
    process.exit(1);
  }

  const total = produtos.length;
  console.log(`📦  ${total.toLocaleString('pt-BR')} produtos encontrados.\n`);

  const client = await pool.connect();
  try {
    await ensureSchema(client);

    const BATCH = 500;
    let totalInserted = 0;
    let totalUpdated  = 0;
    let totalSkipped  = 0;
    const startTime = Date.now();

    for (let i = 0; i < total; i += BATCH) {
      const slice = produtos.slice(i, i + BATCH);
      const rows = [];

      for (let j = 0; j < slice.length; j++) {
        const p = slice[j];
        if (!p || !p.sourceUrl || !p.name) { totalSkipped++; continue; }
        rows.push(toRow(p, i + j));
      }

      if (!rows.length) continue;

      try {
        const { inserted, updated } = await upsertBatch(client, rows);
        totalInserted += inserted;
        totalUpdated  += updated;
      } catch (err) {
        // Fallback: insere um a um em caso de erro de unicidade no lote
        console.warn(`  ⚠️  Erro no lote ${i}-${i+BATCH}: ${err.message}. Tentando row-by-row...`);
        for (const row of rows) {
          try {
            const { inserted, updated } = await upsertBatch(client, [row]);
            totalInserted += inserted;
            totalUpdated  += updated;
          } catch (e2) {
            console.warn(`     ⚠️  Pulando "${row.name}" (${row.source_url.slice(0,60)}): ${e2.message}`);
            totalSkipped++;
          }
        }
      }

      const done = Math.min(i + BATCH, total);
      const pct  = ((done / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\r  [${done.toLocaleString('pt-BR')}/${total.toLocaleString('pt-BR')}] ${pct}% — ${elapsed}s`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log(`✅  IMPORTAÇÃO CONCLUÍDA em ${elapsed}s`);
    console.log(`   Inseridos : ${totalInserted.toLocaleString('pt-BR')}`);
    console.log(`   Atualizados: ${totalUpdated.toLocaleString('pt-BR')}`);
    console.log(`   Ignorados  : ${totalSkipped.toLocaleString('pt-BR')}`);
    console.log('═══════════════════════════════════════');

    // Verifica contagem final no banco
    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM products');
    console.log(`🗄️   Total no banco: ${parseInt(countRows[0].count).toLocaleString('pt-BR')} produtos`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌  Erro fatal:', err);
  process.exit(1);
});
