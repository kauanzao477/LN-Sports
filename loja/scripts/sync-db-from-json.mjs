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
  console.log('JSON carregado:', produtos.length, 'produtos');

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Conectado ao PostgreSQL local\n');

  try {
    const countRes = await client.query('SELECT COUNT(*) as total FROM products');
    const imgRes = await client.query("SELECT SUM(jsonb_array_length(images)) as total_imgs FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
    console.log('DB atual:', countRes.rows[0].total, 'produtos,', imgRes.rows[0].total_imgs, 'imagens');

    console.log('\nCarregando slug->id do banco...');
    const dbRes = await client.query('SELECT id, slug, images, main_image_index FROM products');
    const dbMap = new Map();
    for (const row of dbRes.rows) {
      dbMap.set(row.slug, row);
    }
    console.log('  ', dbMap.size, 'slugs carregados\n');

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    let batch = [];
    const BATCH_SIZE = 500;

    const flush = async () => {
      if (batch.length === 0) return;
      for (const { id, images, main_image_index } of batch) {
        await client.query(
          'UPDATE products SET images = $1::jsonb, main_image_index = $2, updated_at = NOW() WHERE id = $3',
          [JSON.stringify(images), main_image_index, id]
        );
      }
      batch = [];
    };

    for (let i = 0; i < produtos.length; i++) {
      const p = produtos[i];
      const jsonImages = Array.isArray(p.images) ? p.images : [];
      const jsonIdx = typeof p.mainImageIndex === 'number' ? p.mainImageIndex : 0;

      const dbRow = dbMap.get(p.slug);
      if (!dbRow) { notFound++; continue; }

      const dbImages = Array.isArray(dbRow.images)
        ? dbRow.images
        : (typeof dbRow.images === 'string' ? JSON.parse(dbRow.images || '[]') : []);
      const dbIdx = dbRow.main_image_index !== null && dbRow.main_image_index !== undefined
        ? Number(dbRow.main_image_index) : 0;

      if (JSON.stringify(dbImages) === JSON.stringify(jsonImages) && dbIdx === jsonIdx) {
        skipped++;
        continue;
      }

      batch.push({ id: dbRow.id, images: jsonImages, main_image_index: jsonIdx });

      if (batch.length >= BATCH_SIZE) {
        await flush();
        updated += BATCH_SIZE;
        if ((i + 1) % 5000 === 0) {
          console.log('  ...', i + 1, '/', produtos.length, 'processados,', updated, 'atualizados');
        }
      }
    }

    const remaining = batch.length;
    await flush();
    updated += remaining;

    console.log('\nSincronizacao concluida:');
    console.log('  Atualizados:', updated);
    console.log('  Ja corretos:', skipped);
    console.log('  Nao encontrados no DB:', notFound);

    console.log('\nValidando resultado final...');
    const countRes2 = await client.query('SELECT COUNT(*) as total FROM products');
    const imgRes2 = await client.query("SELECT SUM(jsonb_array_length(images)) as total_imgs FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
    console.log('  Produtos:', countRes2.rows[0].total);
    console.log('  Imagens:', imgRes2.rows[0].total_imgs);

    const sampleDb = await client.query('SELECT slug, images, main_image_index FROM products ORDER BY RANDOM() LIMIT 10');
    let diffCount = 0;
    for (const row of sampleDb.rows) {
      const p = produtos.find(x => x.slug === row.slug);
      if (!p) continue;
      const dbImages = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]');
      if (JSON.stringify(dbImages) !== JSON.stringify(p.images || []) || Number(row.main_image_index) !== (p.mainImageIndex || 0)) {
        diffCount++;
      }
    }
    console.log('  Diferencas em amostra de 10:', diffCount);

    if (Number(countRes2.rows[0].total) === 50222 && Number(imgRes2.rows[0].total_imgs) === 537701 && diffCount === 0) {
      console.log('\nVALIDACAO COMPLETA: 50.222 produtos | 537.701 imagens | 0 diferencas');
    } else {
      console.warn('\nAlgum criterio nao foi atingido - revisar manualmente.');
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
