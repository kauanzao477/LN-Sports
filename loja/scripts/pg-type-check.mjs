import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

// Check how pg returns jsonb data
const res = await client.query('SELECT slug, images, pg_typeof(images) as type FROM products LIMIT 5');
for (const row of res.rows) {
  console.log('slug:', row.slug);
  console.log('type:', row.type);
  console.log('typeof images:', typeof row.images);
  console.log('isArray:', Array.isArray(row.images));
  console.log('first item (if any):', Array.isArray(row.images) ? row.images[0] : 'N/A');
  console.log('length:', Array.isArray(row.images) ? row.images.length : 'N/A');
  console.log('---');
}

// Now count properly
const allRes = await client.query('SELECT images FROM products');
let total = 0;
for (const row of allRes.rows) {
  if (Array.isArray(row.images)) {
    total += row.images.length;
  } else if (typeof row.images === 'string') {
    const parsed = JSON.parse(row.images || '[]');
    total += Array.isArray(parsed) ? parsed.length : 0;
  }
}
console.log('Total images (careful count):', total);

await client.end();
