const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory() && !fullPath.match(/node_modules|\.git|dist/)) {
            results = results.concat(walk(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

console.log('?? [1/3] Analisando o código do Admin e Backend...');
const allFiles = walk('./');

// 1. CORRIGIR FRONTEND (Table, Gallery, Modals)
console.log('??? [2/3] Sincronizando lógica visual do Admin com a Loja Pública...');
const jsxFiles = allFiles.filter(f => f.endsWith('.jsx'));
jsxFiles.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    let original = code;

    // Se o componente usa images[0] fixo e não é o utils
    if (code.match(/images\??\.?\[0\]/) && !file.includes('coverUtils')) {
        if (!code.includes('getCoverImage')) {
            const depth = file.split(path.sep).length - 2;
            const prefix = depth > 0 ? '../'.repeat(depth) : './';
            code = "import { getCoverImage } from '" + prefix + "utils/coverUtils';\n" + code;
        }
        code = code.replace(/src=\{[^}]*images\??\.?\[0\][^}]*\}/g, 'src={getCoverImage(product)}');
        code = code.replace(/product\.images\??\.?\[0\]/g, 'getCoverImage(product)');
        
        if (code !== original) {
            fs.writeFileSync(file, code);
            console.log('  ? Frontend atualizado:', file);
        }
    }
});

// 2. CORRIGIR BACKEND (Persistência no Neon via Worker)
console.log('??? [3/3] Corrigindo persistência da API e queries SQL...');
const apiFiles = allFiles.filter(f => f.includes('functions') && f.endsWith('.js'));
apiFiles.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    let original = code;

    // Detecta arquivo de rota UPDATE de produto
    if (code.match(/UPDATE\s+products/i)) {
        if (!code.includes('main_image_index')) {
            // Extrai mainImageIndex do JSON
            code = code.replace(/(const\s+\{[^}]*)(\}\s*=\s*await\s+(?:req|request)\.json\(\);?)/, (m, p1, p2) => {
                return p1.includes('mainImageIndex') ? m : p1.trim() + ', mainImageIndex ' + p2;
            });

            // Injeta query de update secundária específica para a capa
            const extraQuery = `\n    // FIX: Salva a capa explicitamente no banco\n    if (mainImageIndex !== undefined) { await client.query('UPDATE products SET main_image_index = $1 WHERE id = $2', [mainImageIndex, id]); }\n`;
            
            code = code.replace(/(await\s+client\.query\s*\(\s*.*?UPDATE\s+products.*?\);)/i, "$1" + extraQuery);

            if (code !== original) {
                fs.writeFileSync(file, code);
                console.log('  ? Backend corrigido para salvar no DB:', file);
            }
        }
    }
});
console.log('? PROCESSO CONCLUÍDO! Execute npm run build para testar.');
