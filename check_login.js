const fs = require('fs');
const path = require('path');

function searchFiles(dir, keywords) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('dist')) {
      results = results.concat(searchFiles(fullPath, keywords));
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (keywords.some(k => content.toLowerCase().includes(k.toLowerCase()))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const authFiles = searchFiles('loja/functions', ['login', 'jwt', 'auth']);
console.log('=== ARQUIVOS DE AUTENTICACAO ENCONTRADOS ===');
console.log(authFiles.join('\n') || 'Nenhum arquivo encontrado em loja/functions');

authFiles.forEach(f => {
  console.log('\n--- Analisando: ' + f + ' ---');
  const content = fs.readFileSync(f, 'utf8');
  
  const envVars = new Set();
  const regexEnv = /(?:context\.)?env\.([A-Z0-9_]+)/g;
  let match;
  while ((match = regexEnv.exec(content)) !== null) {
    envVars.add(match[1]);
  }
  
  console.log('Variáveis exigidas (env):', Array.from(envVars).join(', ') || 'Nenhuma (ou usa destructuring/outro padrão)');
  
  if (content.includes('process.env')) {
    console.log('⚠️ AVISO: O arquivo faz uso de process.env (não recomendado para CF Pages Functions)');
  }
  if (content.includes('DATABASE_URL') || content.includes('HYPERDRIVE')) {
    console.log('🔍 Conexão com banco de dados detectada na autenticação.');
  }
  if (content.includes('admins') || content.includes('SELECT')) {
    console.log('🔍 Consulta SQL detectada na autenticação (busca no banco).');
  }
});
