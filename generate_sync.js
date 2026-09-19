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
let sql = 'BEGIN;\n';
let count = 0;
json.forEach(p => {
  let url = p.sourceUrl || p.source_url;
  let jsonCount = p.images ? p.images.length : 0;
  if(dbMap.has(url) && dbMap.get(url) !== jsonCount) {
     let imagesStr = JSON.stringify(p.images || []).replace(/'/g, "''");
     let mainIdx = p.mainImageIndex || p.main_image_index || 0;
     if (jsonCount === 0) mainIdx = 0;
     else if (mainIdx >= jsonCount) mainIdx = 0;
     sql += `UPDATE products SET images = '${imagesStr}'::jsonb, main_image_index = ${mainIdx} WHERE source_url = '${url}';\n`;
     count++;
  }
});
sql += 'COMMIT;\n';
fs.writeFileSync('sync_images.sql', sql);
console.log('Arquivo sync_images.sql gerado com sucesso. Contém ' + count + ' comandos de UPDATE.');
