const fs = require("fs");

function fixUseEffect(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, "utf8");
    let result = "";
    let i = 0;
    let modified = false;
    
    while (i < code.length) {
        let match = code.indexOf("useEffect", i);
        if (match === -1) {
            result += code.substring(i);
            break;
        }
        
        let braceIdx = code.indexOf("{", match);
        let parenIdx = code.indexOf("(", match);
        if (braceIdx === -1 || braceIdx > match + 50 || parenIdx > match + 20) {
            result += code.substring(i, match + 9);
            i = match + 9;
            continue;
        }
        
        result += code.substring(i, braceIdx + 1);
        
        let braceCount = 1;
        let j = braceIdx + 1;
        while (j < code.length && braceCount > 0) {
            if (code[j] === "{") braceCount++;
            else if (code[j] === "}") braceCount--;
            j++;
        }
        
        result += code.substring(braceIdx + 1, j);
        
        let k = j;
        while (k < code.length && /\s/.test(code[k])) k++;
        
        if (code[k] === ")") {
            result += ", []";
            modified = true;
            i = j;
        } else {
            i = j;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, result, "utf8");
        console.log("✅ [USE-EFFECT] Loop infinito corrigido (array [] adicionado) em: " + filePath);
    }
}

function fixSetInterval(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, "utf8");
    if (code.includes("setInterval(")) {
        // Converte polling agressivo num unico request assincrono (setTimeout)
        let newCode = code.replace(/setInterval\s*\(/g, "setTimeout(");
        fs.writeFileSync(filePath, newCode, "utf8");
        console.log("✅ [POLLING] setInterval convertido para setTimeout em: " + filePath);
    }
}

console.log("=== INICIANDO CORRECOES DE CONSUMO ===");
fixUseEffect("loja/src/pages/admin/AdminDashboardPage.jsx");
fixUseEffect("loja/src/pages/admin/AdminSettingsPage.jsx");
fixSetInterval("loja/src/context/StoreContext.jsx");
fixSetInterval("loja/src/services/productService.js");
console.log("=== CORRECOES CONCLUIDAS ===");
