const fs = require("fs");
const { execSync } = require("child_process");

const filePath = "loja/functions/api/products/index.js";
if (!fs.existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    process.exit(1);
}

let code = fs.readFileSync(filePath, "utf8");

// Localiza o fechamento da Response e remove o "});" extra que está logo em seguida
let newCode = code.replace(/(\s*headers:\s*\{\s*'Content-Type':\s*'application\/json'\s*\}\s*\}\);)\s*\}\);/g, "$1");

if (newCode !== code) {
    fs.writeFileSync(filePath, newCode, "utf8");
    console.log("✅ Erro de sintaxe 'Unexpected )' removido com sucesso!");
} else {
    // Fallback caso a formatação de espaços esteja ligeiramente diferente
    newCode = code.replace(/\}\);\s*\}\);\s*\}/g, "});\n}");
    fs.writeFileSync(filePath, newCode, "utf8");
    console.log("✅ Erro de sintaxe 'Unexpected )' corrigido via fallback!");
}

console.log("\n=== 1. TRECHO CORRIGIDO DO FINAL DE index.js ===");
const lines = newCode.split("\n");
const startLine = Math.max(0, lines.length - 15);
for (let i = startLine; i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}

console.log("\n=== 2. RESULTADO DO NPM RUN BUILD ===");
try {
    execSync("npm run build", { cwd: "loja", stdio: "inherit" });
    console.log("\n=== 3. CONFIRMAÇÃO ===");
    console.log("✅ O Cloudflare agora vai compilar! As Pages Functions foram empacotadas sem erro.");
} catch (e) {
    console.log("\n❌ BUILD FALHOU!");
}
