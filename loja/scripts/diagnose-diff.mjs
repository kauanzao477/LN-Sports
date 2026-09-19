import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Build JSON map
const jsonMap = new Map();
for (const p of produtos) {
  jsonMap.set(p.slug, p);
}

// Get all DB products
const dbRes = await client.query('SELECT slug, images, main_image_index FROM products');

let totalDiff = 0;
let examples = [];

for (const row of dbRes.rows) {
  const dbImages = Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images || '[]') : []);
  const jsonProd = jsonMap.get(row.slug);
  if (!jsonProd) continue;
  const jsonImages = Array.isArray(jsonProd.images) ? jsonProd.images : [];
  
  if (dbImages.length !== jsonImages.length) {
    totalDiff += (jsonImages.length - dbImages.length);
    if (examples.length < 5) {
      examples.push({ slug: row.slug, db: dbImages.length, json: jsonImages.length });
    }
  }
}

console.log('Total image count difference (json - db):', totalDiff);
console.log('Examples of discrepant products:', JSON.stringify(examples, null, 2));

// Also check products where images array contains nulls or empty strings after sync
const nullCheckRes = await client.query("SELECT slug, jsonb_array_length(images) as img_count FROM products WHERE images @> '[null]'::jsonb LIMIT 5");
console.log('Products with null in images array:', nullCheckRes.rows.length, nullCheckRes.rows);

await client.end();
