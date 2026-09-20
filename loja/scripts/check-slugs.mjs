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
const dbRes = await client.query('SELECT id, slug FROM products');
const dbSlugs = new Set(dbRes.rows.map(r => r.slug));
const jsonSlugs = new Set(produtos.map(p => p.slug));

// DB slugs not in JSON
const notInJSON = dbRes.rows.filter(r => !jsonSlugs.has(r.slug));
console.log('DB products not in JSON (total):', notInJSON.length);
console.log('First 10 examples:');
notInJSON.slice(0, 10).forEach(r => console.log(' ', r.id, r.slug));

// Check for duplicate slugs in DB
const slugCount = new Map();
for (const row of dbRes.rows) {
  slugCount.set(row.slug, (slugCount.get(row.slug) || 0) + 1);
}
const dupes = [...slugCount.entries()].filter(([, count]) => count > 1);
console.log('\nDuplicate slugs in DB:', dupes.length);
if (dupes.length > 0) {
  console.log('Examples:', dupes.slice(0, 5));
}

// Check for duplicate slugs in JSON
const jsonSlugCount = new Map();
for (const p of produtos) {
  jsonSlugCount.set(p.slug, (jsonSlugCount.get(p.slug) || 0) + 1);
}
const jsonDupes = [...jsonSlugCount.entries()].filter(([, count]) => count > 1);
console.log('\nDuplicate slugs in JSON:', jsonDupes.length);

await client.end();
