import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

let totalImages = 0;
let emptyImageProds = 0;
let nullImageProds = 0;
let maxImages = 0;
let slugMaxImages = '';

for (const p of produtos) {
  if (!p.images) { nullImageProds++; continue; }
  if (p.images.length === 0) { emptyImageProds++; continue; }
  totalImages += p.images.length;
  if (p.images.length > maxImages) {
    maxImages = p.images.length;
    slugMaxImages = p.slug;
  }
}

console.log('Total products:', produtos.length);
console.log('Total images (non-empty):', totalImages);
console.log('Products with null images:', nullImageProds);
console.log('Products with empty images []:', emptyImageProds);
console.log('Max images in one product:', maxImages, 'slug:', slugMaxImages);
