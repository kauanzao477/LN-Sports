const fs = require('fs');
const path = 'functions/api/admin/settings.js';

if (fs.existsSync(path)) {
    let code = fs.readFileSync(path, 'utf8');
    
    // Remove o bloco corrompido injetado por engano no arquivo de settings
    const corruptedPattern = /\/\/\s*FIX:\s*Salva a capa explicitamente no banco[\s\S]*?if\s*\(mainImageIndex\s*!==\s*undefined\)[^\n]*\n?/g;
    
    if (corruptedPattern.test(code)) {
        code = code.replace(corruptedPattern, '');
        fs.writeFileSync(path, code, 'utf8');
        console.log('? Arquivo settings.js limpo e corrigido com sucesso!');
    } else {
        console.log('?? O padrão exato não foi encontrado. Verificando linhas corrompidas genéricas...');
        // Limpeza de segurança caso a linha tenha ficado de outra forma
        code = code.replace(/.*main_image_index.*\n?/g, '');
        fs.writeFileSync(path, code, 'utf8');
        console.log('? Limpeza de segurança aplicada em settings.js!');
    }
} else {
    console.log('? Arquivo não encontrado no caminho: ' + path);
}
