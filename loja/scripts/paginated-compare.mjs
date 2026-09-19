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
  const imgs = Array.isArray(p.images) ? p.images : [];
  jsonMap.set(p.slug, { count: imgs.length, idx: p.mainImageIndex || 0 });
}

// Paginate through all DB products to avoid memory issues
let offset = 0;
const limit = 5000;
let discrepancies = [];
let dbGrandTotal = 0;

while (true) {
  const dbRes = await client.query('SELECT slug, images FROM products ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
  if (dbRes.rows.length === 0) break;

  for (const row of dbRes.rows) {
    const imgs = Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images || '[]') : []);
    dbGrandTotal += imgs.length;
    const jsonData = jsonMap.get(row.slug);
    if (!jsonData) continue;
    if (imgs.length !== jsonData.count) {
      discrepancies.push({ slug: row.slug, db: imgs.length, json: jsonData.count });
    }
  }

  offset += limit;
  if (dbRes.rows.length < limit) break;
}

console.log('DB grand total (paginated):', dbGrandTotal);
console.log('Discrepant products:', discrepancies.length);
if (discrepancies.length <= 20) {
  console.log(JSON.stringify(discrepancies, null, 2));
} else {
  const sumDiff = discrepancies.reduce((a, d) => a + (d.json - d.db), 0);
  console.log('Total diff:', sumDiff);
  console.log('First 10:', JSON.stringify(discrepancies.slice(0, 10), null, 2));
}

await client.end();
