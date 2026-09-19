import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:kauan@localhost:5432/lnsports';
const JSON_PATH = path.join(__dirname, '..', 'src', 'data', 'produtos.json');

async function main() {
  console.log('Lendo produtos.json...');
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const produtos = JSON.parse(raw);
  console.log('JSON:', produtos.length, 'produtos');

  // Build maps
  const jsonBySlug = new Map();
  const jsonBySourceUrl = new Map();
  for (const p of produtos) {
    jsonBySlug.set(p.slug, p);
    if (p.sourceUrl) {
      // Keep first occurrence per sourceUrl for match
      if (!jsonBySourceUrl.has(p.sourceUrl)) {
        jsonBySourceUrl.set(p.sourceUrl, p);
      }
    }
  }
  console.log('sourceUrl map size:', jsonBySourceUrl.size);

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Conectado ao PostgreSQL\n');

  try {
    // Get DB products not matched by slug
    const jsonSlugArray = Array.from(jsonBySlug.keys());
    const dbRes = await client.query(
      'SELECT id, slug, source_url, images, main_image_index FROM products WHERE slug NOT IN (SELECT unnest($1::text[]))',
      [jsonSlugArray]
    );
    console.log('Produtos sem match por slug:', dbRes.rows.length);

    let updated = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const row of dbRes.rows) {
      const jsonProd = jsonBySourceUrl.get(row.source_url);
      if (!jsonProd) {
        noMatch++;
        continue;
      }

      const dbImages = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]');
      const jsonImages = Array.isArray(jsonProd.images) ? jsonProd.images : [];
      const jsonIdx = typeof jsonProd.mainImageIndex === 'number' ? jsonProd.mainImageIndex : 0;
      const dbIdx = row.main_image_index !== null && row.main_image_index !== undefined ? Number(row.main_image_index) : 0;

      if (JSON.stringify(dbImages) === JSON.stringify(jsonImages) && dbIdx === jsonIdx) {
        skipped++;
        continue;
      }

      await client.query(
        'UPDATE products SET images = $1::jsonb, main_image_index = $2, updated_at = NOW() WHERE id = $3',
        [JSON.stringify(jsonImages), jsonIdx, row.id]
      );
      updated++;

      if (updated % 500 === 0) {
        console.log('  ...', updated, 'atualizados via sourceUrl');
      }
    }

    console.log('\nSincronizacao via sourceUrl concluida:');
    console.log('  Atualizados:', updated);
    console.log('  Ja corretos:', skipped);
    console.log('  Sem match:', noMatch);

    // Final validation
    const r1 = await client.query('SELECT COUNT(*) as total FROM products');
    const r2 = await client.query("SELECT SUM(jsonb_array_length(images)) as imgs FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
    console.log('\nValidacao final:');
    console.log('  Produtos:', r1.rows[0].total);
    console.log('  Imagens:', r2.rows[0].imgs);

    const expectedProducts = 50222;
    const expectedImages = 537701;
    if (Number(r1.rows[0].total) === expectedProducts) {
      console.log('  OK: produtos = 50.222');
    } else {
      console.warn('  WARN: produtos =', r1.rows[0].total, '(esperado 50222)');
    }
    if (Number(r2.rows[0].imgs) === expectedImages) {
      console.log('  OK: imagens = 537.701');
    } else {
      console.warn('  WARN: imagens =', r2.rows[0].imgs, '(esperado 537701, diferenca:', expectedImages - Number(r2.rows[0].imgs), ')');
    }

  } finally {
    await client.end();
    console.log('\nConexao encerrada.');
  }
}

main().catch(err => {
  console.error('ERRO FATAL:', err.message);
  process.exit(1);
});
