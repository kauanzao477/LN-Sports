import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Get all slugs from DB
const dbRes = await client.query('SELECT slug FROM products');
const dbSlugs = new Set(dbRes.rows.map(r => r.slug));

// Check which JSON slugs are not in DB
let notInDB = [];
let notInDBImages = 0;
for (const p of produtos) {
  if (!dbSlugs.has(p.slug)) {
    const count = Array.isArray(p.images) ? p.images.length : 0;
    notInDB.push({ slug: p.slug, images: count });
    notInDBImages += count;
  }
}

console.log('JSON products not in DB:', notInDB.length);
console.log('Images in those products:', notInDBImages);
if (notInDB.length <= 20) {
  console.log(JSON.stringify(notInDB, null, 2));
}

// Also check DB slugs not in JSON
const jsonSlugs = new Set(produtos.map(p => p.slug));
let notInJSON = [];
for (const row of dbRes.rows) {
  if (!jsonSlugs.has(row.slug)) {
    notInJSON.push(row.slug);
  }
}
console.log('\nDB products not in JSON:', notInJSON.length);
if (notInJSON.length <= 10) console.log(notInJSON);

await client.end();
