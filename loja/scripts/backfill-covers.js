#!/usr/bin/env node
/**
 * backfill-covers.js
 *
 * Define a foto primária (capa oficial do álbum) dos produtos de calçados
 * e camisas já cadastrados, buscando a capa oficial de cada álbum no Yupoo
 * (tag og:image da página — a mesma fonte usada pelo scraper novo).
 *
 * Uso:
 *   node loja/scripts/backfill-covers.js [--limit N] [--dry-run] [--db]
 *
 *   --limit N   processa no máximo N produtos (para testar)
 *   --dry-run   só consulta e mostra o que faria, sem gravar nada
 *   --db        além do JSON, atualiza cover_hash/main_image_index no
 *               PostgreSQL (requer DATABASE_URL no ambiente / loja/.env).
 *               Sem --db: atualiza só os JSONs; depois rode
 *               node loja/scripts/import-produtos-fix.js para subir ao banco.
 *
 * Segurança:
 *   - Faz backup de produtos.json antes da 1ª gravação.
 *   - Retoma de onde parou (backfill-progress.json) — pode interromper e
 *     rodar de novo sem duplicar trabalho.
 *   - Só ALTERA coverHash/mainImageIndex de calçados e camisas; nunca
 *     reordena images, nunca apaga nada. A escolha manual do admin continua valendo
 *     (o frontend prioriza o override do admin).
 *   - Gravações atômicas (.tmp + rename) a cada lote.
 */

import dotenv from 'dotenv';
import { readFileSync, writeFileSync, copyFileSync, existsSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  usesOfficialCover,
  extractYupooPhotoHash,
  findCoverIndex,
  isValidCoverIndex,
} from '../src/utils/coverUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────
const CONCURRENCY = 8;
const TIMEOUT_MS = 20000;
const RETRIES = 2;
const SAVE_EVERY = 50;

// Senhas dos catálogos protegidos (iguais ao scraper/crawler.py)
const LOCK_COOKIES = {
  '1998shoe': 'indexlockcode=HJH001077; indexlockcodeRemember=HJH001077',
  'aj-dongli': 'indexlockcode=888888; indexlockcodeRemember=888888',
};

const args = process.argv.slice(2);
function parseLimit(argv) {
  const eq = argv.find((a) => a.startsWith('--limit='));
  if (eq) return parseInt(eq.split('=')[1], 10) || 0;
  const i = argv.indexOf('--limit');
  if (i >= 0 && argv[i + 1]) return parseInt(argv[i + 1], 10) || 0;
  return 0;
}
const LIMIT = parseLimit(args);
const DRY_RUN = args.includes('--dry-run');
const WITH_DB = args.includes('--db');

const JSON_PATH = path.resolve(__dirname, '..', 'src', 'data', 'produtos.json');
const PUBLIC_JSON_PATH = path.resolve(__dirname, '..', 'public', 'produtos.json');
const PROGRESS_PATH = path.resolve(__dirname, 'backfill-progress.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function albumHeaders(sourceUrl) {
  let referer = 'https://x.yupoo.com/';
  let cookie = '';
  try {
    const u = new URL(sourceUrl);
    referer = `${u.protocol}//${u.host}/`;
    const sub = u.hostname.split('.')[0]; // ex: aj-dongli
    if (LOCK_COOKIES[sub]) cookie = LOCK_COOKIES[sub];
  } catch { /* mantém padrão */ }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
  };
  if (cookie) headers['Cookie'] = cookie;
  return headers;
}

/** Extrai o content do <meta property="og:image"> sem dependências externas. */
function parseOgImage(html) {
  const m1 = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (m1) return m1[1].trim();
  const m2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m2 ? m2[1].trim() : '';
}

async function fetchCoverHash(sourceUrl) {
  let lastErr = '';
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(sourceUrl, { signal: ctrl.signal, headers: albumHeaders(sourceUrl) });
      clearTimeout(t);
      if (res.status === 429 || res.status === 503) {
        lastErr = `HTTP ${res.status}`;
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const html = await res.text();
      const og = parseOgImage(html);
      if (!og) return { ok: false, error: 'sem og:image' };
      const hash = extractYupooPhotoHash(og);
      if (!hash) return { ok: false, error: 'og:image não é foto (logo/bloqueio)' };
      return { ok: true, hash };
    } catch (e) {
      lastErr = e.name === 'AbortError' ? 'timeout' : (e.message || 'erro');
      await sleep(1000 * (attempt + 1));
    }
  }
  return { ok: false, error: lastErr || 'falha' };
}

function atomicWriteJsonSync(filePath, data) {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, filePath);
}

async function main() {
  console.log('📂 Lendo ' + JSON_PATH + ' ...');
  const produtos = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  console.log(`📦 Total no JSON: ${produtos.length.toLocaleString('pt-BR')}`);

  let progress = { done: {}, stats: { updated: 0, kept: 0, failed: 0 } };
  if (existsSync(PROGRESS_PATH) && LIMIT === 0) {
    try {
      progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8'));
      // Falhas são sempre retentadas (ex: senha do fornecedor corrigida depois).
      let retried = 0;
      for (const [key, val] of Object.entries(progress.done)) {
        if (String(val).startsWith('fail:')) {
          delete progress.done[key];
          retried++;
        }
      }
      progress.stats.failed = 0;
      console.log(`🔁 Retomando: ${Object.keys(progress.done).length.toLocaleString('pt-BR')} já processados, ${retried.toLocaleString('pt-BR')} falhas serão retentadas.`);
    } catch { /* recomeça */ }
  }

  // Alvos: calçados + camisas sem capa válida definida
  const targets = [];
  for (const p of produtos) {
    if (!p || !p.sourceUrl || !Array.isArray(p.images) || p.images.length === 0) continue;
    if (!usesOfficialCover(p.category)) continue;
    if (progress.done[p.sourceUrl]) continue;
    const hasCover = p.coverHash && findCoverIndex(p.images, p.coverHash) >= 0;
    const hasIndex = isValidCoverIndex(p.mainImageIndex, p.images) && p.mainImageIndex !== 0;
    if (hasCover || hasIndex) {
      progress.done[p.sourceUrl] = 'skip';
      continue;
    }
    targets.push(p);
    if (LIMIT > 0 && targets.length >= LIMIT) break;
  }
  console.log(`🎯 Calçados + camisas para processar: ${targets.length.toLocaleString('pt-BR')}${DRY_RUN ? ' (DRY-RUN — nada será gravado)' : ''}`);

  let backupDone = false;
  let processed = 0;
  const stats = progress.stats;
  const failures = [];

  async function worker(queue) {
    while (queue.length) {
      const p = queue.shift();
      const res = await fetchCoverHash(p.sourceUrl);
      if (res.ok) {
        const idx = findCoverIndex(p.images, res.hash);
        if (idx >= 0) {
          if (!DRY_RUN) {
            p.coverHash = res.hash;
            p.mainImageIndex = idx;
          }
          progress.done[p.sourceUrl] = `ok:${idx}`;
          stats.updated++;
        } else {
          progress.done[p.sourceUrl] = 'nocovermatch';
          stats.kept++;
        }
      } else {
        progress.done[p.sourceUrl] = `fail:${res.error}`;
        stats.failed++;
        if (failures.length < 20) failures.push(`${p.sourceUrl} :: ${res.error}`);
      }
      processed++;
      if (processed % SAVE_EVERY === 0) {
        if (!DRY_RUN) {
          if (!backupDone) {
            const bak = `${JSON_PATH}.bak-${new Date().toISOString().slice(0, 10)}`;
            copyFileSync(JSON_PATH, bak);
            console.log(`🛡️  Backup criado: ${bak}`);
            backupDone = true;
          }
          atomicWriteJsonSync(JSON_PATH, produtos);
          writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
        }
        console.log(`  ... ${processed}/${targets.length} | capa ok: ${stats.updated} | mantidos: ${stats.kept} | falhas: ${stats.failed}`);
      }
    }
  }

  const queue = [...targets];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, () => worker(queue)));

  if (!DRY_RUN && processed > 0) {
    if (!backupDone) {
      const bak = `${JSON_PATH}.bak-${new Date().toISOString().slice(0, 10)}`;
      copyFileSync(JSON_PATH, bak);
      console.log(`🛡️  Backup criado: ${bak}`);
    }
    atomicWriteJsonSync(JSON_PATH, produtos);
    // Espelha no public/produtos.json se existir
    if (existsSync(PUBLIC_JSON_PATH)) {
      atomicWriteJsonSync(PUBLIC_JSON_PATH, produtos);
      console.log('🪞 public/produtos.json espelhado.');
    }
    writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
  }

  console.log('\n═══════════════════════════════════════');
  console.log(DRY_RUN ? '🔍 DRY-RUN concluído (nada gravado)' : '✅ BACKFILL CONCLUÍDO');
  console.log(`   Capas aplicadas : ${stats.updated}`);
  console.log(`   Mantidos (índice 0) : ${stats.kept}`);
  console.log(`   Falhas (tentar de novo depois) : ${stats.failed}`);
  if (failures.length) {
    console.log('   Exemplos de falha:');
    for (const f of failures) console.log(`     - ${f}`);
  }
  console.log('═══════════════════════════════════════');

  if (WITH_DB && !DRY_RUN) {
    await pushToDb(produtos);
  } else if (!DRY_RUN) {
    console.log('\n💡 Para subir ao PostgreSQL, rode: node loja/scripts/import-produtos-fix.js');
  }
}

async function pushToDb(produtos) {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.error('❌ --db informado mas DATABASE_URL não definida. JSONs já foram atualizados.');
    return;
  }
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cover_hash TEXT DEFAULT ''`);
    const rows = produtos.filter((p) => p && p.sourceUrl && (p.coverHash || Number.isInteger(p.mainImageIndex)));
    console.log(`🗄️  Atualizando ${rows.length.toLocaleString('pt-BR')} produtos no banco...`);
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const values = [];
      const sets = slice.map((p, j) => {
        const b = j * 3;
        values.push(p.coverHash || '', Number.isInteger(p.mainImageIndex) ? p.mainImageIndex : 0, p.sourceUrl);
        return `($${b + 1}::text, $${b + 2}::int, $${b + 3}::text)`;
      });
      await client.query(
        `UPDATE products AS pr SET cover_hash = v.ch, main_image_index = v.mi
         FROM (VALUES ${sets.join(',')}) AS v(ch, mi, su)
         WHERE pr.source_url = v.su`,
        values
      );
      process.stdout.write(`\r  [${Math.min(i + BATCH, rows.length)}/${rows.length}]`);
    }
    console.log('\n✅ Banco atualizado.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
