const fs = require("fs");
const path = require("path");

console.log("==================================================");
console.log(" DIAGNÓSTICO: ADMIN > PRODUTOS EM PRODUÇÃO");
console.log("==================================================\n");

// 1. Inspeciona variáveis de ambiente do Vite
console.log("=== 1. VERIFICANDO VITE_API_URL ===");
const envFiles = [".env", ".env.production", ".env.local"];
let foundUrl = null;

envFiles.forEach(file => {
    const p = path.join("loja", file);
    if (fs.existsSync(p)) {
        console.log(`[${file}] Existe no disco.`);
        const content = fs.readFileSync(p, "utf8");
        content.split("\n").forEach(line => {
            if (line.includes("VITE_API_URL")) {
                console.log(` 🚨 ALERTA: ${line.trim()}`);
                foundUrl = line.split("=")[1]?.trim();
            }
        });
    }
});

// Verifica no wrangler.toml (se estiver exposto para o client)
const wPath = "loja/wrangler.toml";
if (fs.existsSync(wPath)) {
    const content = fs.readFileSync(wPath, "utf8");
    content.split("\n").forEach(line => {
        if (line.includes("VITE_API_URL")) {
            console.log(` 🚨 ALERTA (wrangler.toml): ${line.trim()}`);
        }
    });
}

if (!foundUrl) {
    console.log(" Nenhuma VITE_API_URL fixa encontrada localmente. Se estiver vazia aqui, verifique nas 'Environment Variables' do painel web do Cloudflare.");
}

// 2. Análise do comportamento
console.log("\n=== 2. ANÁLISE DE FLUXO (SIMULAÇÃO DE STATUS) ===");
if (foundUrl) {
    console.log(`- URL REAL CHAMADA PELO ADMIN: ${foundUrl}/api/products?page=1&limit=16&sort=newest`);
    console.log(`- Causa do erro: A requisição está vazando para fora do Cloudflare e batendo no antigo servidor (${foundUrl}).`);
    console.log("- Status HTTP provável: Falha de CORS, 404, 502 (desligado) ou contrato JSON diferente do esperado.");
} else {
    console.log("- URL REAL CHAMADA PELO ADMIN: https://[SEU_SITE].pages.dev/api/products?page=1&limit=16&sort=newest");
    console.log("- Status HTTP: A investigar através da aba Network (F12) no navegador em produção.");
}

console.log("\n=== 3. DIAGNÓSTICO DO ADMIN PRODUCTS PAGE ===");
const adminPage = "loja/src/pages/admin/AdminProductsPage.jsx";
if (fs.existsSync(adminPage)) {
    const code = fs.readFileSync(adminPage, "utf8");
    if (code.includes("console.error('[AdminProductsPage] erro ao carregar:'")) {
        console.log("✔️ Confirmado: O AdminProductsPage captura o erro com try/catch e deixa o state 'products' como array vazio []. O erro real está escondido no F12 (Console/Network) do seu navegador.");
    }
}
