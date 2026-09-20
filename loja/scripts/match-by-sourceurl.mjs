import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));
const jsonSlugs = new Set(produtos.map(p => p.slug));

// Build JSON map by sourceUrl
const jsonBySourceUrl = new Map();
for (const p of produtos) {
  if (p.sourceUrl) {
    if (!jsonBySourceUrl.has(p.sourceUrl)) {
      jsonBySourceUrl.set(p.sourceUrl, p);
    }
  }
}

// Get DB products not matched by slug
const dbRes = await client.query('SELECT id, slug, source_url, images FROM products WHERE slug NOT IN (SELECT unnest($1::text[]))', [Array.from(jsonSlugs)]);
console.log('DB products not matched by slug:', dbRes.rows.length);

let matchedBySourceUrl = 0;
let notMatchedBySourceUrl = 0;
let diffBySourceUrl = 0;

for (const row of dbRes.rows) {
  const jsonProd = jsonBySourceUrl.get(row.source_url);
  if (jsonProd) {
    matchedBySourceUrl++;
    const dbImages = Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]');
    const jsonImages = Array.isArray(jsonProd.images) ? jsonProd.images : [];
    if (JSON.stringify(dbImages) !== JSON.stringify(jsonImages)) {
      diffBySourceUrl++;
    }
  } else {
    notMatchedBySourceUrl++;
  }
}

console.log('Matched by sourceUrl:', matchedBySourceUrl);
console.log('Not matched by sourceUrl either:', notMatchedBySourceUrl);
console.log('Matched by sourceUrl but images differ:', diffBySourceUrl);

await client.end();
