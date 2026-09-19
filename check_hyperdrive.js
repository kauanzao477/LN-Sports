const fs = require("fs");
const path = require("path");

function search(dir, exts) {
    let res = [];
    if(!fs.existsSync(dir)) return res;
    for(let f of fs.readdirSync(dir)) {
        let p = path.join(dir, f);
        if(fs.statSync(p).isDirectory() && !p.includes("node_modules") && !p.includes("dist")) {
            res = res.concat(search(p, exts));
        } else if(exts.some(e => p.endsWith(e))) {
            res.push(p);
        }
    }
    return res;
}

console.log("=== 1. MAPEAMENTO DE QUERIES (BACKEND) ===");
let nPlusOne = [];
search("loja/functions", [".js", ".ts"]).forEach(f => {
    let lines = fs.readFileSync(f, "utf8").split("\n");
    let inLoop = false;
    lines.forEach((l, i) => {
        if(l.match(/for\s*\(|while\s*\(|\.map\s*\(/)) inLoop = true;         if(l.match(/}\s*\)/)) inLoop = false;
        
        if(l.match(/\.query\(/) || l.match(/SELECT\s/i) || l.match(/UPDATE\s/i) || l.match(/INSERT\s/i)) {
            let name = f.replace(/\\/g, '/');
            console.log(`[DB] ${name}:${i+1} -> ${l.trim().substring(0, 90)}`);
            if(inLoop || l.includes('Promise.all')) {
                nPlusOne.push(`${name}:${i+1} -> Loop SQL/Promise detectado (Risco N+1)`);
            }
        }
    });
});

console.log("\n=== 2. MAPEAMENTO DE REQUISIÇÕES (FRONTEND) ===");
let effectLoops = [];
let intervalLoops = [];
search("loja/src", [".js", ".jsx", ".ts", ".tsx"]).forEach(f => {
    let lines = fs.readFileSync(f, "utf8").split("\n");
    let inEffect = false;
    let effectStart = 0;
    let hasFetch = false;

    lines.forEach((l, i) => {
        let name = f.replace(/\\/g, '/');
        if(l.match(/setInterval\(/)) {
            intervalLoops.push(`${name}:${i+1} -> Uso de setInterval disparando código contínuo`);
        }
        if(l.match(/useEffect\s*\(\s*\(\)\s*=>/)) {
            inEffect = true; effectStart = i; hasFetch = false;
        }
        if(inEffect) {
            if(l.match(/fetch\(|axios\.|api\./)) hasFetch = true;
            if(l.match(/^\s*},?\s*$/)) {
                inEffect = false;
                if(hasFetch && !l.includes("]")) {
                    effectLoops.push(`${name}:${effectStart+1} -> useEffect sem [] chamando API! (Loop Infinito)`);
                }
            }
        }
    });
});

console.log("\n=== 3. RESULTADOS SUSPEITOS DE ALTO CONSUMO ===");
if(nPlusOne.length > 0) {
    console.log("\n🚨 [ALERTA BACKEND] Queries dentro de loops (N+1):");
    nPlusOne.forEach(a => console.log("   " + a));
}
if(effectLoops.length > 0) {
    console.log("\n🚨 [ALERTA FRONTEND] Loops Infinitos de Request (useEffect sem dependências):");
    effectLoops.forEach(a => console.log("   " + a));
}
if(intervalLoops.length > 0) {
    console.log("\n🚨 [ALERTA FRONTEND] Polling Contínuo (setInterval):");
    intervalLoops.forEach(a => console.log("   " + a));
}
if (nPlusOne.length === 0 && effectLoops.length === 0 && intervalLoops.length === 0) {
    console.log("\nℹ️ Nenhum loop crítico evidente encontrado via regex. O excesso pode vir de chamadas individuais em listas (map).");
}
