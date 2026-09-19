import fs from 'fs';
import path from 'path';

const originalPath = path.resolve('./src/data/produtos.json');
console.log('Checking original produtos.json at:', originalPath);
if (!fs.existsSync(originalPath)) {
  console.error('produtos.json not found!');
  process.exit(1);
}

const raw = fs.readFileSync(originalPath, 'utf-8');
const original = JSON.parse(raw);
const totalProducts = original.length;
let totalImages = 0;
let validSourceUrls = 0;

for (const p of original) {
  if (Array.isArray(p.images)) totalImages += p.images.length;
  if (p.sourceUrl && typeof p.sourceUrl === 'string') validSourceUrls++;
}

console.log('Original produtos.json counts:');
console.log(' - Products:', totalProducts);
console.log(' - Images:', totalImages);
console.log(' - Products with sourceUrl:', validSourceUrls);

const manifestPath = path.resolve('./public/data/catalog/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
console.log('\nManifest counts:');
console.log(' - Products:', manifest.totals.products);
console.log(' - Images:', manifest.totals.images);

// Check all chunk sizes in public/data/catalog/
const catalogDir = path.resolve('./public/data/catalog');
const files = fs.readdirSync(catalogDir);
console.log('\nChunk file sizes:');
let allUnder25MB = true;
for (const file of files) {
  const stat = fs.statSync(path.join(catalogDir, file));
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(' - ' + file + ': ' + sizeMB + ' MB');
  if (stat.size > 25 * 1024 * 1024) allUnder25MB = false;
}

console.log('\nAll chunks < 25 MB:', allUnder25MB);
if (totalProducts === 50222 && totalImages === 537701 && manifest.totals.products === 50222 && manifest.totals.images === 537701 && allUnder25MB) {
  console.log('\n✅ ALL COUNTS AND SIZE CONSTRAINTS VERIFIED PERFECTLY!');
} else {
  console.error('\n❌ Mismatch in counts or constraints!');
  process.exit(1);
}
