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
let jsonGrandTotal = 0;
for (const p of produtos) {
  const imgs = Array.isArray(p.images) ? p.images : [];
  jsonMap.set(p.slug, imgs.length);
  jsonGrandTotal += imgs.length;
}

// Get all DB products and count
const dbRes = await client.query('SELECT slug, images FROM products');
let dbGrandTotal = 0;
for (const row of dbRes.rows) {
  const imgs = Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images || '[]') : []);
  dbGrandTotal += imgs.length;
}

console.log('JSON grand total (counted manually):', jsonGrandTotal);
console.log('DB grand total (counted manually):', dbGrandTotal);
console.log('Difference:', jsonGrandTotal - dbGrandTotal);

// Now check what the DB reports via SUM vs manual count
const r = await client.query("SELECT SUM(jsonb_array_length(images)) as sum_imgs FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
console.log('DB SUM via SQL:', r.rows[0].sum_imgs);

await client.end();
