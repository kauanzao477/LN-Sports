const fs = require("fs");
["loja/src/pages/admin/AdminDashboardPage.jsx", "loja/src/pages/admin/AdminSettingsPage.jsx"].forEach(file => {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, "utf8");
    // Regex que encontra useEffect que termina exatamente em }) sem o array de dependências
    let newCode = code.replace(/(useEffect\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?)\}\s*\)/g, "$1}, [])");
    if (newCode !== code) {
        fs.writeFileSync(file, newCode, "utf8");
        console.log("✅ [USE-EFFECT] Loop infinito neutralizado via Regex em: " + file);
    } else {
        console.log("⚠️ [USE-EFFECT] Nenhuma alteração necessária ou já corrigido em: " + file);
    }
});
