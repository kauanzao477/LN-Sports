const fs = require('fs');
const json = JSON.parse(fs.readFileSync('loja/src/data/produtos.json', 'utf8'));
const csv = fs.readFileSync('db_urls.csv', 'utf8').trim().split(/\r?\n/);
const dbMap = new Map();
csv.forEach(line => {
  let firstComma = line.indexOf(',');
  if(firstComma > -1) {
    let url = line.substring(0, firstComma).replace(/^"|"$/g, '');
    let count = parseInt(line.substring(firstComma + 1));
    dbMap.set(url, count);
  }
});
const jsonMap = new Map();
json.forEach(p => {
  let url = p.sourceUrl || p.source_url;
  jsonMap.set(url, p.images ? p.images.length : 0);
});
let diff = [];
dbMap.forEach((count, url) => {
  if(jsonMap.has(url)) {
    let jCount = jsonMap.get(url);
    if(jCount !== count) diff.push({url, db: count, json: jCount});
  }
});
let diffCount = diff.reduce((acc, d) => acc + (d.json - d.db), 0);
console.log('--- COMPARACAO POR SOURCE_URL ---');
console.log('Produtos com divergencia de imagens: ' + diff.length);
console.log('Total de imagens faltando no BD: ' + diffCount);
if (diff.length > 0) {
  console.log('Exemplos de divergencia:');
  diff.slice(0, 3).forEach(d => console.log('URL: ' + d.url + ' | BD: ' + d.db + ' | JSON: ' + d.json));
}
