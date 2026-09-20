const fs = require("fs");
const { execSync } = require("child_process");

const filePath = "loja/functions/api/products/index.js";
if (!fs.existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");
const lines = code.split("\n");

console.log("=== 1. TRECHO ORIGINAL (Linhas 70-85) ===");
for (let i = 69; i < 85; i++) {
    if (lines[i] !== undefined) console.log(`${i+1}: ${lines[i]}`);
}

// CORREÇÃO DA SINTAXE:
// Remove vírgulas duplas (,,) separadas por espaços ou quebras de linha
let newCode = code.replace(/,\s*,/g, ",");
// Remove vírgula sobrando no início de um objeto ({ ,)
newCode = newCode.replace(/\{\s*,/g, "{");
// Remove vírgula sobrando no final de um objeto (, }) - previne erros no esbuild
newCode = newCode.replace(/,\s*\}/g, "}");

if (newCode !== code) {
    fs.writeFileSync(filePath, newCode, "utf8");
}

const newLines = newCode.split("\n");
console.log("\n=== 2. CORREÇÃO APLICADA ===");
console.log("- Vírgulas duplas (,,) ou (, \\n ,) foram reduzidas a uma única vírgula.");
console.log("- Vírgulas órfãs próximas a chaves ({ , ou , }) foram limpas.");

console.log("\n=== 3. TRECHO CORRIGIDO (Linhas 70-85) ===");
for (let i = 69; i < 85; i++) {
    if (newLines[i] !== undefined) console.log(`${i+1}: ${newLines[i]}`);
}

console.log("\n=== 4. RESULTADO DO NPM RUN BUILD ===");
try {
    execSync("npm run build", { cwd: "loja", stdio: "inherit" });
    console.log("\n=== 5. CONFIRMAÇÃO ===");
    console.log("✅ As Pages Functions agora são empacotadas sem erro.");
} catch (e) {
    console.log("\n❌ BUILD FALHOU!");
}
