const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('./functions');
let updated = false;

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    // Procura arquivos que lidam com update/produtos na API
    if (code.includes('client.query') && (code.toLowerCase().includes('update') || code.toLowerCase().includes('product'))) {
        console.log('?? Analisando arquivo de API:', file);
        
        if (!code.includes('main_image_index')) {
            // Garante que mainImageIndex seja extraído do body da requisição
            code = code.replace(/const\s+\{([^}]+)\}\s*=\s*await\s+req\.json\(\);?/, (match, p1) => {
                if (!p1.includes('mainImageIndex')) {
                    return `const {${p1}, mainImageIndex} = await req.json();`;
                }
                return match;
            });

            // Insere o update do main_image_index logo após o update principal
            const sqlFix = `\n    // Salva explicitamente a capa escolhida no Neon\n    if (mainImageIndex !== undefined) {\n        await client.query('UPDATE products SET main_image_index = $1 WHERE id = $2', [mainImageIndex, id]);\n    }\n`;
            
            code = code.replace(/(await\s+client\.query\s*\([\s\S]*?UPDATE[\s\S]*?\);\s*)/i, `$1${sqlFix}`);
            
            fs.writeFileSync(file, code);
            console.log('  ? Sucesso! Backend corrigido em:', file);
            updated = true;
        } else {
            console.log('  ?? Este arquivo já possui suporte a main_image_index.');
        }
    }
});

if (!updated) {
    console.log('?? Nenhuma rota de update automática foi alterada. Vamos verificar manualmente se necessário.');
} else {
    console.log('?? Backend ajustado com sucesso!');
}
