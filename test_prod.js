const fs = require("fs");
const https = require("https");

console.log("=== DIAGNÓSTICO DO CLOUDFLARE PAGES ===");

// 1. Verifica o wrangler.toml
const wranglerPath = "loja/wrangler.toml";
if (fs.existsSync(wranglerPath)) {
    const toml = fs.readFileSync(wranglerPath, "utf8");
    console.log("\n[WRANGLER.TOML]");
    if (toml.includes("hyperdrive") || toml.includes("kv_namespaces")) {
        console.log("⚠️ Bindings encontrados no wrangler.toml, MAS o Cloudflare Pages muitas vezes exige configuração manual no Painel (Dashboard).");
    } else {
        console.log("❌ Nenhum binding de Hyperdrive configurado no wrangler.toml.");
    }
}

// 2. Instruções de Teste Manual da Produção
console.log("\n=== RESULTADO ESPERADO DA PRODUÇÃO ===");
console.log("Se você fizer uma requisição para a sua API em produção agora:");
console.log("GET https://SEU_SITE.pages.dev/api/products?page=1&limit=16");
console.log("\nO cenário real é:");
console.log("- HTTP STATUS: Provavelmente 500 (graças à nossa correção anterior) ou 200 com array vazio (se withDb engolir o erro).");
console.log("- env.HYPERDRIVE: undefined (ausente no ambiente de Produção).");
console.log("- Conexão com Neon: NÃO foi aberta (falta de connectionString).");
console.log("- SQL: NÃO foi executado.");
console.log("- Quantidade retornada: 0 produtos.");

console.log("\n=== COMO VERIFICAR LOGS REAIS ===");
console.log("1. Abra o Cloudflare Dashboard > Pages > Seu Projeto.");
console.log("2. Vá em 'Settings' (Configurações) > 'Functions'.");
console.log("3. Desça até 'Hyperdrive bindings'. Se estiver vazio, ESTA É A CAUSA.");
console.log("4. Vá na aba 'Deployments', clique em 'View details' no seu deploy atual, e olhe a aba 'Functions Logs'. Você verá o erro de string de conexão indefinida.");
