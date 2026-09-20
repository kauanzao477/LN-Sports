import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Count sourceUrl occurrences
const srcCount = new Map();
for (const p of produtos) {
  if (p.sourceUrl) {
    srcCount.set(p.sourceUrl, (srcCount.get(p.sourceUrl) || 0) + 1);
  }
}

const dupes = [...srcCount.entries()].filter(([, count]) => count > 1);
console.log('Total sourceUrls:', srcCount.size);
console.log('Duplicate sourceUrls:', dupes.length);

// Check image count variance for duplicate sourceUrls
let totalDifference = 0;
for (const [srcUrl, count] of dupes) {
  const matching = produtos.filter(p => p.sourceUrl === srcUrl);
  const imgCounts = matching.map(p => Array.isArray(p.images) ? p.images.length : 0);
  const maxCount = Math.max(...imgCounts);
  const minCount = Math.min(...imgCounts);
  if (maxCount !== minCount) {
    totalDifference += (maxCount - minCount);
  }
}
console.log('Total image difference from choosing wrong sourceUrl variant:', totalDifference);
console.log('Total unique sourceUrls (map size would be):', srcCount.size);
console.log('JSON products:', produtos.length, 'so', produtos.length - srcCount.size, 'are pure duplicates');
