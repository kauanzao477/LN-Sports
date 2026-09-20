const fs = require("fs");
const { execSync } = require("child_process");

const localPath = "loja/src/utils/coverUtils.js";
if (fs.existsSync(localPath)) {
    let code = fs.readFileSync(localPath, "utf8");

    // Limpa a injeção quebrada e a função antiga inteira, parando exatamente antes do próximo comentário (/**) ou próxima função
    let newCode = code.replace(/export function resolveCoverIndex[\s\S]*?(?=\/\*\*|export function|export const|$)/,
`export function resolveCoverIndex(product, adminOverride = null) {
  if (adminOverride !== null && adminOverride !== undefined) return Number(adminOverride);
  if (product && product.mainImageIndex !== undefined && product.mainImageIndex !== null) {
    return Number(product.mainImageIndex);
  }
  return 0;
}\n\n`);

    fs.writeFileSync(localPath, newCode, "utf8");
    console.log("✅ Sintaxe corrigida com sucesso em coverUtils.js!");
}

console.log("\nExecutando npm run build para validar integridade...");
try {
    execSync("npm run build", { cwd: "loja", stdio: "inherit" });
    console.log("\n✅ BUILD PASSOU COM SUCESSO!");
} catch (e) {
    console.log("\n❌ BUILD FALHOU!");
}
