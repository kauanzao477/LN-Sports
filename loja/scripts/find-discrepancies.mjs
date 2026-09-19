import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));
const jsonMap = new Map();
for (const p of produtos) {
  jsonMap.set(p.slug, p);
}

// Get all DB products
const dbRes = await client.query('SELECT id, slug, images FROM products');

let discrepancies = [];
for (const row of dbRes.rows) {
  const dbImages = Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images || '[]') : []);
  const jsonProd = jsonMap.get(row.slug);
  if (!jsonProd) continue;
  const jsonImages = Array.isArray(jsonProd.images) ? jsonProd.images : [];

  if (dbImages.length !== jsonImages.length) {
    discrepancies.push({
      id: row.id,
      slug: row.slug,
      db_count: dbImages.length,
      json_count: jsonImages.length,
      diff: jsonImages.length - dbImages.length
    });
  }
}

const totalDiff = discrepancies.reduce((acc, d) => acc + d.diff, 0);
console.log('Discrepant products:', discrepancies.length);
console.log('Total diff (json - db):', totalDiff);

if (discrepancies.length <= 20) {
  console.log('All discrepancies:', JSON.stringify(discrepancies, null, 2));
} else {
  console.log('First 10:', JSON.stringify(discrepancies.slice(0, 10), null, 2));
  console.log('Last 10:', JSON.stringify(discrepancies.slice(-10), null, 2));
}

await client.end();
