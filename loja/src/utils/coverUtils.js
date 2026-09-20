/**
 * coverUtils.js — Sistema de foto primária (capa) da LN SPORTS.
 *
 * Problema resolvido:
 * - Nos álbuns de tênis/chuteiras do Yupoo, a 1ª foto (images[0]) costuma ser
 *   uma capa de divulgação do fornecedor (com logo/texto = "marca d'água"),
 *   enquanto a foto do tênis EM PAR (a que o cliente quer ver no card) é a
 *   foto de CAPA oficial escolhida pelo vendedor no álbum.
 * - O Yupoo expõe essa capa oficial na tag `<meta property="og:image">` da
 *   página do álbum. O scraper captura o hash dessa foto (coverHash) e grava
 *   o índice correspondente em `mainImageIndex`.
 *
 * Este módulo centraliza a regra para que loja (productService), servidor
 * (server.js) e backfill usem EXATAMENTE a mesma lógica. A escolha manual do
 * admin (setProductCover / ⭐ Capa) sempre tem prioridade máxima.
 */

// Categorias de calçados onde a capa oficial (par) deve ser a foto primária.
// Funciona por prefixo normalizado para cobrir variações
// ("Tênis Casuais - Senha: ...", "Catálogo de Chuteiras - 01", etc.).
const SHOE_CATEGORY_PREFIXES = [
  'tenis casuais',
  'tenis esportivos',
  'tenis esportivo',
  'tenis de corrida',
  'tenis on running',
  'sapatilhas de atletismo',
  'sapatilha',
  'chuteiras',
  'chuteira',
  'catalogo de chuteiras',
  'catálogo de chuteiras',
];

// Categorias de camisas/camisetas: a capa oficial do álbum (foto principal
// da peça, escolhida pelo vendedor) também deve ser a foto primária no
// lugar da 1ª foto (que costuma ser capa de divulgação com logo).
const SHIRT_CATEGORY_PREFIXES = [
  'camisetas de time',
  'camiseta',
  'camisa',
];

function normalizeCategoryName(cat) {
  if (!cat) return '';
  return String(cat)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Diz se a categoria é de calçado (usa capa oficial = par). */
export function isShoeCategory(category) {
  const norm = normalizeCategoryName(category);
  if (!norm) return false;
  return SHOE_CATEGORY_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/** Diz se a categoria é de camisa/camiseta (usa capa oficial do álbum). */
export function isShirtCategory(category) {
  const norm = normalizeCategoryName(category);
  if (!norm) return false;
  return SHIRT_CATEGORY_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/**
 * Diz se a categoria usa a capa oficial do álbum como foto primária
 * (calçados + camisas). Demais categorias seguem o comportamento padrão.
 */
export function usesOfficialCover(category) {
  return isShoeCategory(category) || isShirtCategory(category);
}

/**
 * Extrai o hash da foto Yupoo a partir da URL.
 * Formato: https://photo.yupoo.com/<conta>/<hash>/<arquivo>
 * O <hash> identifica a MESMA foto em qualquer resolução
 * (ex: og:image .../01247915c7/medium.jpg == original .../01247915c7/a8a78ca4.jpg).
 * Retorna '' se não for URL de foto Yupoo válida.
 */
export function extractYupooPhotoHash(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes('yupoo.com')) return '';
    // Ignora logos/ícones do próprio Yupoo (nunca são foto de produto)
    if (parsed.pathname.startsWith('/icons/')) return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    // Esperado: [conta, hash, arquivo]
    if (parts.length < 3) return '';
    const hash = parts[1];
    // Hash real: hexadecimal (fotos com id curto tipo big.jpg/medium.jpg não valem)
    if (!/^[a-f0-9]{6,}$/i.test(hash)) return '';
    return hash.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Encontra o índice, dentro de `images`, da foto correspondente ao coverHash
 * (comparação por hash, independente de resolução).
 * Retorna -1 se não encontrar.
 */
export function findCoverIndex(images, coverHash) {
  if (!Array.isArray(images) || !coverHash) return -1;
  const target = String(coverHash).toLowerCase();
  for (let i = 0; i < images.length; i++) {
    if (extractYupooPhotoHash(images[i]) === target) return i;
  }
  return -1;
}

/**
 * Valida um índice de capa: inteiro dentro dos limites da lista.
 */
export function isValidCoverIndex(index, images) {
  return (
    Number.isInteger(index) &&
    Array.isArray(images) &&
    index >= 0 &&
    index < images.length
  );
}

/**
 * Resolve a foto primária de um produto.
 *
 * Ordem de prioridade (a 1ª válida vence):
 *  1. Escolha manual do admin (adminIndex) — nunca é sobrescrita.
 *  2. mainImageIndex já gravado no produto (scraper/backfill) — válido.
 *  3. coverHash (capa oficial do álbum = foto em par) — casa por hash.
 *  4. Fallback: 0 (1ª foto — comportamento anterior, sem "cagada").
 *
 * Nunca joga erro: em qualquer dúvida retorna 0.
 */
export function resolveCoverIndex(product, adminOverride = null) {
  if (adminOverride !== null && adminOverride !== undefined) return Number(adminOverride);
  if (product && product.mainImageIndex !== undefined && product.mainImageIndex !== null) {
    return Number(product.mainImageIndex);
  }
  return 0;
}

/**
 * Retorna a URL da foto primária (respeitando admin -> gravado -> par -> 0).
 */
export function getPrimaryImage(product, adminIndex = null) {
  const images = product?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const idx = resolveCoverIndex(product, adminIndex);
  return images[idx] || images[0] || null;
}
