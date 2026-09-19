import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Count ALL items in images arrays, including nulls/empty strings
let total = 0;
let nullItems = 0;
let emptyItems = 0;
let validItems = 0;
let examples = [];

for (const p of produtos) {
  if (!Array.isArray(p.images)) continue;
  for (const img of p.images) {
    total++;
    if (img === null || img === undefined) {
      nullItems++;
      if (examples.length < 3) examples.push({ slug: p.slug, item: img });
    } else if (img === '' || (typeof img === 'string' && img.trim() === '')) {
      emptyItems++;
    } else {
      validItems++;
    }
  }
}

console.log('Total array items (all types):', total);
console.log('Valid image URLs:', validItems);
console.log('Null items:', nullItems);
console.log('Empty string items:', emptyItems);
console.log('Examples of nulls:', JSON.stringify(examples));
