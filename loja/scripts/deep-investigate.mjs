import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Build JSON map by sourceUrl with full product
const jsonBySourceUrl = new Map();
for (const p of produtos) {
  if (p.sourceUrl) jsonBySourceUrl.set(p.sourceUrl, p);
}

// Check if any DB sourceUrl appears multiple times  
const dbRes = await client.query('SELECT source_url, COUNT(*) as cnt FROM products GROUP BY source_url HAVING COUNT(*) > 1 LIMIT 10');
console.log('DB sourceUrls with multiple products:', dbRes.rows.length);
if (dbRes.rows.length > 0) {
  console.log('Examples:', dbRes.rows);
}

// The real question: for each DB product, what does the JSON say the image count should be?
// Paginate and compare
let jsonTotal = 0;
for (const p of produtos) {
  jsonTotal += Array.isArray(p.images) ? p.images.length : 0;
}
console.log('JSON total images:', jsonTotal);

// Now check each DB product manually
let dbManualTotal = 0;
let notSynced = [];

const allDb = await client.query('SELECT id, slug, source_url, images FROM products');
const jsonBySlug = new Map(produtos.map(p => [p.slug, p]));

for (const row of allDb.rows) {
  const dbImages = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]');
  dbManualTotal += dbImages.length;
  
  // What should it be?
  const jsonProd = jsonBySlug.get(row.slug) || jsonBySourceUrl.get(row.source_url);
  if (jsonProd) {
    const expected = Array.isArray(jsonProd.images) ? jsonProd.images.length : 0;
    if (dbImages.length !== expected) {
      notSynced.push({ id: row.id, slug: row.slug, db: dbImages.length, json: expected });
    }
  }
}

console.log('DB manual total:', dbManualTotal);
console.log('Products still not synced:', notSynced.length);
if (notSynced.length <= 20) {
  console.log(JSON.stringify(notSynced, null, 2));
} else {
  const totalDiff = notSynced.reduce((a, d) => a + d.json - d.db, 0);
  console.log('Total diff:', totalDiff);
  console.log('First 10:', JSON.stringify(notSynced.slice(0, 10), null, 2));
}

await client.end();
