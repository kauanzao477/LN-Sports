import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'produtos.json'), 'utf8'));

// Count slug occurrences
const slugCount = new Map();
for (const p of produtos) {
  slugCount.set(p.slug, (slugCount.get(p.slug) || 0) + 1);
}
const dupeSlugEntries = [...slugCount.entries()].filter(([, count]) => count > 1);
console.log('Duplicate slugs in JSON:', dupeSlugEntries.length);
if (dupeSlugEntries.length > 0) {
  console.log('First 5 dupe slug groups:');
  for (const [slug, count] of dupeSlugEntries.slice(0, 5)) {
    const matches = produtos.filter(p => p.slug === slug);
    console.log(`  slug="${slug}" appears ${count} times, image counts: ${matches.map(p => Array.isArray(p.images) ? p.images.length : 0).join(',')}, sourceUrls: ${matches.map(p => p.sourceUrl).join(' | ')}`);
  }
}

// Total images counting only unique slugs (first occurrence)
const seenSlug = new Set();
let uniqueSlugTotal = 0;
for (const p of produtos) {
  if (!seenSlug.has(p.slug)) {
    seenSlug.add(p.slug);
    uniqueSlugTotal += Array.isArray(p.images) ? p.images.length : 0;
  }
}
console.log('\nImages counting only first occurrence of each slug:', uniqueSlugTotal);

// Total images counting only unique sourceUrls (first occurrence)
const seenSrc = new Set();
let uniqueSrcTotal = 0;
for (const p of produtos) {
  if (p.sourceUrl && !seenSrc.has(p.sourceUrl)) {
    seenSrc.add(p.sourceUrl);
    uniqueSrcTotal += Array.isArray(p.images) ? p.images.length : 0;
  }
}
console.log('Images counting only first occurrence of each sourceUrl:', uniqueSrcTotal);
console.log('JSON grand total (all):', produtos.reduce((a, p) => a + (Array.isArray(p.images) ? p.images.length : 0), 0));
