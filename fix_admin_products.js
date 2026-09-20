const fs = require("fs");
const { execSync } = require("child_process");

console.log("==================================================");
console.log(" CORRIGINDO CONTRATO ADMIN > PRODUTOS (SEM BANCO)");
console.log("==================================================\n");

let changedFiles = [];

// 1. CORRIGIR productService.js
const psPath = "loja/src/services/productService.js";
if (fs.existsSync(psPath)) {
    let psCode = fs.readFileSync(psPath, "utf8");
    const adminBlockRegex = /if\s*\(\s*isAdmin\s*\)\s*\{[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?\}\s*\}/;
    const newAdminBlock = `if (isAdmin) {
      try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('limit', limitCount);
        if (status && status !== 'all') params.set('status', status);
        if (category) params.set('category', category);
        if (subcategory) params.set('subcategory', subcategory);
        if (featured !== null) params.set('featured', featured);
        if (searchQuery) params.set('search', searchQuery);
        if (sortBy) params.set('sort', sortBy === 'newest' ? 'newest' : sortBy);

        const result = await apiFetch(\`/api/products?\${params.toString()}\`);
        if (result?.data) {
          result.data = result.data.map(p => ({ ...p, category: inferCategory(p) }));
        }
        return result;
      } catch (err) {
        console.error('[productService] ERRO CRÍTICO na API do Admin:', err.message);
        throw err; // Propaga erro, SEM fallback para estático
      }
    }`;
    
    if (adminBlockRegex.test(psCode)) {
        let newPsCode = psCode.replace(adminBlockRegex, newAdminBlock);
        if (newPsCode !== psCode) {
            fs.writeFileSync(psPath, newPsCode, "utf8");
            changedFiles.push(psPath);
        }
    }
}

// 2. CORRIGIR loja/functions/api/products/index.js
const fnPath = "loja/functions/api/products/index.js";
if (fs.existsSync(fnPath)) {
    let fnCode = fs.readFileSync(fnPath, "utf8");
    let originalFnCode = fnCode;

    // A. Nivelar a paginação removendo o encapsulamento "pagination: { ... }"
    // Transforma: pagination: { total: X, totalPages: Y } -> total: X, totalPages: Y
    fnCode = fnCode.replace(/pagination\s*:\s*\{([\s\S]*?)\}/g, "$1");

    // B. Remover catch block que mascara erro com HTTP 200 + data: []
    // E substituir por um HTTP 500 com mensagem clara
    fnCode = fnCode.replace(/catch\s*\(([^)]+)\)\s*\{[\s\S]*?data\s*:\s*\[\][\s\S]*?\}/g, 
    `catch ($1) {
    console.error('Database Error:', $1);
    return new Response(JSON.stringify({ error: 'Erro interno ao consultar o banco de dados.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }`);

    if (fnCode !== originalFnCode) {
        fs.writeFileSync(fnPath, fnCode, "utf8");
        changedFiles.push(fnPath);
    }
}

// BUILD DE VALIDAÇÃO
console.log("Executando npm run build para validar integridade...");
try {
    execSync("npm run build", { cwd: "loja", stdio: "inherit" });
    console.log("\n✅ BUILD PASSOU COM SUCESSO!");
} catch (e) {
    console.log("\n❌ BUILD FALHOU!");
}

console.log("\nARQUIVOS REALMENTE ALTERADOS:");
changedFiles.forEach(f => console.log(" - " + f));
