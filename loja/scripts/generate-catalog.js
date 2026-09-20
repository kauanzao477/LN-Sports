#!/usr/bin/env node
/**
 * generate-catalog.js
 *
 * Gera os arquivos estáticos particionados do catálogo em loja/public/data/catalog/
 * a partir de loja/src/data/produtos.json, SEM MODIFICAR o arquivo original.
 *
 * Regras estritas:
 * - Preserva exatamente 50.222 produtos e 537.701 imagens.
 * - Preserva sourceUrl e todos os campos dos produtos.
 * - Garante que NENHUM arquivo gerado exceda 25 MiB (limite do Cloudflare Pages).
 * - Remove arquivos monolíticos antigos em loja/public/ para não quebrar o deploy.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const lojaDir = path.resolve(workspaceRoot, 'loja');

const SRC_PRODUTOS_JSON = path.resolve(lojaDir, 'src', 'data', 'produtos.json');
const OUTPUT_DIR = path.resolve(lojaDir, 'public', 'data', 'catalog');

// Mapeamento idêntico ao productService / categoryService
const CATEGORY_ALIASES = {
  'Tênis Casuais - Senha: HJH001077': 'Tênis Casuais',
  'Tênis Esportivos - Senha: 888888': 'Tênis Esportivos',
  'Tênis Esportivos - Senha: 888886': 'Tênis Esportivos',
};

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferCategory(product) {
  const url = product.sourceUrl || '';
  if (url.includes('lvguccinike.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('ywq2000.x.yupoo.com')) return 'Chuteiras';
  if (url.includes('mzrycm102618.x.yupoo.com') && url.includes('/4742786')) return 'Chuteiras Infantil';
  if (product.category === 'Catálogo de Chuteiras - 01' ||
      product.category === 'Catálogo de Chuteiras - 02' ||
      product.category === 'Catálogo de Chuteiras - 03') return 'Chuteiras';
  if (product.category === 'Catálogo de Chuteiras - Infantil') return 'Chuteiras Infantil';
  if (CATEGORY_ALIASES[product.category]) return CATEGORY_ALIASES[product.category];
  return product.category;
}

export function generateCatalog() {
  console.log('📦 [generate-catalog] Lendo fonte original em:', SRC_PRODUTOS_JSON);
  if (!fs.existsSync(SRC_PRODUTOS_JSON)) {
    throw new Error(`Arquivo fonte original não encontrado: ${SRC_PRODUTOS_JSON}`);
  }

  const rawData = fs.readFileSync(SRC_PRODUTOS_JSON, 'utf-8');
  const products = JSON.parse(rawData);

  console.log(`🔍 [generate-catalog] Total de produtos lidos: ${products.length}`);
  if (products.length !== 50222) {
    throw new Error(`Validação falhou: esperado 50.222 produtos, encontrado ${products.length}`);
  }

  let totalImagesCount = 0;
  let withSourceUrlCount = 0;
  for (const p of products) {
    if (p.images && Array.isArray(p.images)) {
      totalImagesCount += p.images.length;
    }
    if (p.sourceUrl) {
      withSourceUrlCount++;
    }
  }

  console.log(`🖼️  [generate-catalog] Total de imagens contadas: ${totalImagesCount}`);
  if (totalImagesCount !== 537701) {
    throw new Error(`Validação falhou: esperado 537.701 imagens, encontrado ${totalImagesCount}`);
  }

  if (withSourceUrlCount !== 50222) {
    throw new Error(`Validação falhou: esperado 50.222 sourceUrl, encontrado ${withSourceUrlCount}`);
  }

  // Agrupa produtos por categoria canônica
  const categoryGroups = new Map();
  const searchIndex = [];
  const slugMap = {};

  for (let i = 0; i < products.length; i++) {
    const raw = products[i];
    const cat = inferCategory(raw);
    const catSlug = slugify(cat);

    // Produto com categoria padronizada
    const product = {
      id: raw.slug || raw.id || String(i),
      ...raw,
      category: cat,
      published: raw.published !== false,
      status: raw.status || 'published',
    };

    if (!categoryGroups.has(catSlug)) {
      categoryGroups.set(catSlug, {
        name: cat,
        slug: catSlug,
        items: []
      });
    }
    categoryGroups.get(catSlug).items.push(product);

    // Capa do produto para índice leve de busca
    const coverIdx = Number.isInteger(product.mainImageIndex) && product.mainImageIndex >= 0 && product.images && product.images.length > product.mainImageIndex
      ? product.mainImageIndex
      : 0;
    const coverImg = product.images && product.images[coverIdx] ? product.images[coverIdx] : (product.images && product.images[0] ? product.images[0] : '');

    searchIndex.push({
      name: product.name,
      slug: product.slug,
      category: cat,
      subcategory: product.subcategory || '',
      image: coverImg,
      sourceUrl: product.sourceUrl,
      featured: product.featured ? 1 : 0
    });
  }

  // Garante que o diretório de saída existe
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const categoriesMetadata = [];
  const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24 MiB (segurança abaixo do limite de 25 MiB)

  let writtenProducts = 0;
  let writtenImages = 0;

  for (const [catSlug, group] of categoryGroups.entries()) {
    const items = group.items;
    const jsonFull = JSON.stringify(items);
    const byteLength = Buffer.byteLength(jsonFull, 'utf-8');

    const chunks = [];

    // Se o grupo exceder 18 MiB (ex: Tênis Esportivos tem 30 MiB), divide em 2 partes
    if (byteLength > 18 * 1024 * 1024) {
      const half = Math.ceil(items.length / 2);
      const part1 = items.slice(0, half);
      const part2 = items.slice(half);

      const file1 = `${catSlug}-1.json`;
      const file2 = `${catSlug}-2.json`;

      const p1Path = path.join(OUTPUT_DIR, file1);
      const p2Path = path.join(OUTPUT_DIR, file2);

      fs.writeFileSync(p1Path, JSON.stringify(part1));
      fs.writeFileSync(p2Path, JSON.stringify(part2));

      chunks.push(file1, file2);

      for (const p of part1) {
        slugMap[p.slug] = { categorySlug: catSlug, chunk: file1 };
        if (p.images) writtenImages += p.images.length;
      }
      for (const p of part2) {
        slugMap[p.slug] = { categorySlug: catSlug, chunk: file2 };
        if (p.images) writtenImages += p.images.length;
      }
      writtenProducts += items.length;

      console.log(`  📁 ${catSlug} [dividido em 2 partes]: ${file1} (${part1.length} prods), ${file2} (${part2.length} prods)`);
    } else {
      const fileName = `${catSlug}.json`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(filePath, jsonFull);
      chunks.push(fileName);

      for (const p of items) {
        slugMap[p.slug] = { categorySlug: catSlug, chunk: fileName };
        if (p.images) writtenImages += p.images.length;
      }
      writtenProducts += items.length;

      console.log(`  📁 ${catSlug}: ${fileName} (${items.length} prods, ${(byteLength / 1024 / 1024).toFixed(2)} MiB)`);
    }

    categoriesMetadata.push({
      id: catSlug,
      name: group.name,
      slug: catSlug,
      productCount: items.length,
      chunks,
    });
  }

  // Pre-computa destaques para HomePage (1 de cada uma das 4 categorias candidatas principais)
  const CANDIDATE_FEATURED = [
    'camisetas-de-time',
    'camisetas-de-time-retro',
    'chuteiras',
    'tenis-casuais',
    'tenis-on-running-e-hoka'
  ];
  const homeFeatured = [];
  for (const slug of CANDIDATE_FEATURED) {
    if (homeFeatured.length >= 4) break;
    const group = categoryGroups.get(slug);
    if (group && group.items.length > 0) {
      homeFeatured.push(group.items[0]);
    }
  }

  // Pre-computa 16 produtos recentes para HomePage
  const sortedRecent = [...products]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 16)
    .map((p, idx) => ({
      id: p.slug || p.id || String(idx),
      ...p,
      category: inferCategory(p),
      published: p.published !== false,
      status: p.status || 'published',
    }));

  const manifest = {
    totals: {
      products: products.length,
      images: totalImagesCount,
    },
    categories: categoriesMetadata,
    slugMap,
    homeFeatured,
    homeRecent: sortedRecent,
  };

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`  📄 manifest.json salvo com sucesso.`);

  const searchIndexPath = path.join(OUTPUT_DIR, 'search-index.json');
  fs.writeFileSync(searchIndexPath, JSON.stringify(searchIndex));
  console.log(`  🔍 search-index.json salvo com sucesso (${searchIndex.length} itens).`);

  // Validação estrita
  if (writtenProducts !== 50222) {
    throw new Error(`Erro: produtos gravados (${writtenProducts}) != 50.222`);
  }
  if (writtenImages !== 537701) {
    throw new Error(`Erro: imagens gravadas (${writtenImages}) != 537.701`);
  }

  // Verifica que nenhum arquivo em public/data/catalog excede MAX_FILE_SIZE
  const files = fs.readdirSync(OUTPUT_DIR);
  for (const f of files) {
    const s = fs.statSync(path.join(OUTPUT_DIR, f));
    if (s.size > MAX_FILE_SIZE) {
      throw new Error(`Arquivo gerado excede 25 MiB: ${f} (${(s.size / 1024 / 1024).toFixed(2)} MiB)`);
    }
  }

  // Limpeza de arquivos monolíticos antigos em loja/public/ que excedem 25 MiB
  const legacyPublicJson = path.resolve(lojaDir, 'public', 'produtos.json');
  if (fs.existsSync(legacyPublicJson)) {
    const s = fs.statSync(legacyPublicJson);
    if (s.size > 20 * 1024 * 1024) {
      console.log(`🧹 Substituindo ${legacyPublicJson} monolítico por ponteiro leve...`);
      fs.writeFileSync(legacyPublicJson, JSON.stringify({
        status: 'ok',
        message: 'Catalogo particionado para Cloudflare Pages',
        manifest: '/data/catalog/manifest.json',
        totalProducts: 50222,
        totalImages: 537701
      }));
    }
  }

  const legacyPublicDataJson = path.resolve(lojaDir, 'public', 'data', 'produtos.json');
  if (fs.existsSync(legacyPublicDataJson)) {
    const s = fs.statSync(legacyPublicDataJson);
    if (s.size > 20 * 1024 * 1024) {
      console.log(`🧹 Substituindo ${legacyPublicDataJson} monolítico por ponteiro leve...`);
      fs.writeFileSync(legacyPublicDataJson, JSON.stringify({
        status: 'ok',
        message: 'Catalogo particionado para Cloudflare Pages',
        manifest: '/data/catalog/manifest.json',
        totalProducts: 50222,
        totalImages: 537701
      }));
    }
  }

  console.log('\n✅ [generate-catalog] SUCESSO COMPLETO!');
  console.log(`   - Produtos confirmados: ${writtenProducts}`);
  console.log(`   - Imagens confirmadas: ${writtenImages}`);
  console.log(`   - Todos os arquivos < 25 MiB: OK\n`);
}

// Executa se chamado diretamente
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try {
    generateCatalog();
  } catch (err) {
    console.error('❌ Erro no generate-catalog:', err);
    process.exit(1);
  }
}
