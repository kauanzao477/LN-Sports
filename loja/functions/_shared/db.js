import pg from 'pg';
import { resolveCoverIndex } from '../../src/utils/coverUtils.js';

const { Client } = pg;

/**
 * Conecta ao PostgreSQL via Cloudflare Hyperdrive ou DATABASE_URL.
 * Fecha o cliente no bloco finally para evitar vazamentos de sockets no edge.
 */
export async function withDb(env, callback) {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error('DATABASE_NOT_CONFIGURED');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Normaliza a linha bruta do banco para o modelo de produto da loja.
 */
export function rowToProduct(row) {
  if (!row) return null;
  const rawCat = row.category || '';
  let publicCat = rawCat;
  const lowerCat = rawCat.toLowerCase().trim();
  if (lowerCat.startsWith('tênis casuais') || lowerCat.startsWith('tenis casuais')) {
    publicCat = 'Tênis Casuais';
  } else if (lowerCat.startsWith('tênis esportivos') || lowerCat.startsWith('tenis esportivos')) {
    publicCat = 'Tênis Esportivos';
  } else if (lowerCat.includes('chuteiras - infantil') || lowerCat === 'chuteiras infantil') {
    publicCat = 'Chuteiras Infantil';
  } else if (lowerCat.includes('chuteiras - 0') || lowerCat === 'chuteiras') {
    publicCat = 'Chuteiras';
  }

  const images = Array.isArray(row.images)
    ? row.images
    : (typeof row.images === 'string' ? JSON.parse(row.images || '[]') : []);

  const storedIndex = (row.main_image_index !== null && row.main_image_index !== undefined)
    ? row.main_image_index
    : (row.mainImageIndex !== null && row.mainImageIndex !== undefined ? row.mainImageIndex : null);

  const mainImageIndex = resolveCoverIndex(
    { images, coverHash: row.cover_hash || row.coverHash || null },
    Number.isInteger(storedIndex) ? storedIndex : null
  );

  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    category: publicCat,
    originalCategory: row.original_category || row.category,
    subcategory: row.subcategory || '',
    images: images,
    coverHash: row.cover_hash || row.coverHash || null,
    sourceUrl: row.source_url,
    sourceProvider: row.source_provider || 'yupoo',
    description: row.description || '',
    published: row.published,
    featured: row.featured,
    status: row.status,
    mainImageIndex: mainImageIndex,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
