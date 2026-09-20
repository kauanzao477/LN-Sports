import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

// Exact count
const r1 = await client.query("SELECT COUNT(*) as products FROM products");
const r2 = await client.query("SELECT SUM(jsonb_array_length(images)) as imgs FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
const r3 = await client.query("SELECT COUNT(*) as empty FROM products WHERE images IS NULL OR images = '[]'::jsonb");

console.log('Products total:', r1.rows[0].products);
console.log('Images (non-empty):', r2.rows[0].imgs);
console.log('Products with no images:', r3.rows[0].empty);

// Also count including products with empty images
const r4 = await client.query("SELECT SUM(CASE WHEN images IS NULL OR images = '[]'::jsonb THEN 0 ELSE jsonb_array_length(images) END) as total_all FROM products");
console.log('Total images (all products):', r4.rows[0].total_all);

await client.end();
