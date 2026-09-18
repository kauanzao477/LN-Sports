import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  await client.connect();
  console.log('Connected to:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
  
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  
  console.log('Tables found:', tables.rows.map(r => r.table_name));
  
  for (const row of tables.rows) {
    const tableName = row.table_name;
    const countRes = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    console.log(`Table: ${tableName} -> ${countRes.rows[0].count} rows`);
    
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    console.log(`  Columns:`, colsRes.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }
  
  await client.end();
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
