const fs = require("fs");
const { execSync } = require("child_process");

console.log("==================================================");
console.log(" INICIANDO CORREÇÃO LOCAL (SEM BANCO)");
console.log("==================================================\n");

let changedFiles = [];

// --- CORREÇÃO 1: TÊNIS / IMAGEM DE CAPA ---
const coverPath = "loja/src/utils/coverUtils.js";
if (fs.existsSync(coverPath)) {
    let code = fs.readFileSync(coverPath, "utf8");
    // Sobrescreve a lógica para respeitar ESTRITAMENTE o mainImageIndex canônico
    const regex = /export function resolveCoverIndex[\s\S]*?(?=export|function|const|$)/m;
    const newLogic = `export function resolveCoverIndex(product, adminOverride = null) {
  if (adminOverride !== null && adminOverride !== undefined) return Number(adminOverride);
  if (product && product.mainImageIndex !== undefined && product.mainImageIndex !== null) {
    return Number(product.mainImageIndex);
  }
  return 0; // Fallback final apenas se não existir mainImageIndex
}\n\n`;
    if (regex.test(code)) {
        let newCode = code.replace(regex, newLogic);
        if (newCode !== code) {
            fs.writeFileSync(coverPath, newCode, "utf8");
            changedFiles.push(coverPath);
        }
    }
}

const cardPath = "loja/src/components/product/ProductCard.jsx";
if (fs.existsSync(cardPath)) {
    let code = fs.readFileSync(cardPath, "utf8");
    let newCode = code.replace(/const coverImgIndex = [^;]+;/, "const coverImgIndex = product.mainImageIndex !== undefined && product.mainImageIndex !== null ? Number(product.mainImageIndex) : 0;");
    if (newCode !== code) {
        fs.writeFileSync(cardPath, newCode, "utf8");
        if (!changedFiles.includes(cardPath)) changedFiles.push(cardPath);
    }
}

// --- CORREÇÃO 2: ADMIN > PRODUTOS (productService.js) ---
const psPath = "loja/src/services/productService.js";
if (fs.existsSync(psPath)) {
    let code = fs.readFileSync(psPath, "utf8");
    // Remove fallback silencioso do admin, obrigando o respeito ao contrato da API
    let newCode = code.replace(/catch\s*\((err\vert{}e)\)\s*\{\s*console\.warn\(\'\[productService\] API admin indisponível.*?\);\s*\}/g,
    `catch (err) {
        console.error('[productService] ERRO na API do Admin:', err.message);
        throw err; // Propaga erro para a UI do AdminProductsPage, SEM fallback para estático
      }`);
    if (newCode !== code) {
        fs.writeFileSync(psPath, newCode, "utf8");
        changedFiles.push(psPath);
    }
}

// --- BUILD DE VALIDAÇÃO ---
console.log("Executando npm run build para validar integridade...");
try {
    execSync("npm run build", { cwd: "loja", stdio: "inherit" });
    console.log("\n✅ BUILD PASSOU!");
} catch (e) {
    console.log("\n❌ BUILD FALHOU!");
}

console.log("\nARQUIVOS REALMENTE ALTERADOS:");
changedFiles.forEach(f => console.log(" - " + f));
