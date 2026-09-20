import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });
await client.connect();

const dbR = await client.query("SELECT SUM(jsonb_array_length(images)) as total FROM products WHERE images IS NOT NULL AND images != '[]'::jsonb");
console.log('DB images now:', dbR.rows[0].total);

const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));
let jsonTotal = 0;
for (const p of produtos) {
  jsonTotal += Array.isArray(p.images) ? p.images.length : 0;
}
console.log('JSON images total:', jsonTotal);

// Check generate-catalog output too
console.log('produtos.length:', produtos.length);

await client.end();
