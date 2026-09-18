import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:kauan@localhost:5432/lnsports' });

async function validate() {
  try {
    // Check status distribution
    const status = await pool.query("SELECT status, COUNT(*) as cnt FROM products GROUP BY status");
    console.log('=== STATUS ===');
    status.rows.forEach(r => console.log(`  status='${r.status}': ${r.cnt}`));

    // Check products by category and status
    const byCatStatus = await pool.query(`
      SELECT category, status, COUNT(*) as cnt 
      FROM products 
      GROUP BY category, status 
      ORDER BY category, status
    `);
    console.log('\n=== CATEGORIA + STATUS ===');
    byCatStatus.rows.forEach(r => console.log(`  ${r.category} | status='${r.status}': ${r.cnt}`));

    // Check chuteiras with LIKE
    const chut1 = await pool.query("SELECT COUNT(*) FROM products WHERE lower(category) LIKE '%chuteiras - 0%'");
    console.log('\nChuteiras LIKE chuteiras - 0:', chut1.rows[0].count);

    const chut2 = await pool.query("SELECT COUNT(*) FROM products WHERE lower(category) LIKE '%chuteiras - infantil%'");
    console.log('Chuteiras infantil LIKE:', chut2.rows[0].count);

    // Check main_image_index
    const idx = await pool.query(`
      SELECT main_image_index, COUNT(*) as cnt 
      FROM products 
      WHERE lower(category) LIKE 'tênis esportivos%'
      GROUP BY main_image_index
      ORDER BY cnt DESC
    `);
    console.log('\n=== TÊNIS ESPORTIVOS - main_image_index ===');
    idx.rows.forEach(r => console.log(`  index ${r.main_image_index}: ${r.cnt}`));

    // Sample esportivos products with high index
    const highIdx = await pool.query(`
      SELECT name, main_image_index, jsonb_array_length(images) as img_count
      FROM products 
      WHERE lower(category) LIKE 'tênis esportivos%' 
      AND main_image_index > 0
      LIMIT 10
    `);
    console.log('\n=== AMOSTRA TÊNIS ESPORTIVOS com index > 0 ===');
    highIdx.rows.forEach(r => console.log(`  [idx=${r.main_image_index}, imgs=${r.img_count}] ${r.name}`));

  } catch (e) {
    console.error('ERRO:', e.message);
  } finally {
    await pool.end();
  }
}

validate();
