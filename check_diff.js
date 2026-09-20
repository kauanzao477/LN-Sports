const fs = require('fs');
const json = JSON.parse(fs.readFileSync('loja/src/data/produtos.json', 'utf8'));
const csv = fs.readFileSync('db_state.csv', 'utf8').trim().split(/\r?\n/);
const dbMap = new Map();
csv.forEach(line => {
  let parts = line.split(',');
  if(parts.length >= 2) dbMap.set(parts[0].replace(/^"|"$/g, ''), parseInt(parts[1]));
});
const jsonMap = new Map();
json.forEach(p => jsonMap.set(p.slug, p.images ? p.images.length : 0));
let dbOnly = [], jsonOnly = [], diff = [];
dbMap.forEach((count, slug) => {
  if(!jsonMap.has(slug)) dbOnly.push(slug);
  else if(jsonMap.get(slug) !== count) diff.push({slug, db: count, json: jsonMap.get(slug)});
});
jsonMap.forEach((count, slug) => {
  if(!dbMap.has(slug)) jsonOnly.push(slug);
});
console.log('--- RESULTADOS DA COMPARACAO ---');
console.log('1. Produtos APENAS no BD (sobrando): ' + dbOnly.length);
console.log('2. Produtos APENAS no JSON (faltando): ' + jsonOnly.length);
console.log('3. Produtos em ambos, mas com divergência de imagens: ' + diff.length);
if (diff.length > 0) console.log('   Exemplo de divergência: ' + diff[0].slug + ' (BD: ' + diff[0].db + ' imgs, JSON: ' + diff[0].json + ' imgs)');
