/**
 * Gera slugs consistentes, URL-friendly e sem caracteres especiais.
 * Remove acentuação (ex: 'São Paulo' -> 'sao-paulo').
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD') // Separa caracteres de seus diacríticos
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres inválidos
    .replace(/[\s_]+/g, '-') // Substitui espaços e underlines por traço
    .replace(/-+/g, '-') // Remove traços repetidos
    .replace(/^-+|-+$/g, ''); // Remove traços no início ou fim
}
