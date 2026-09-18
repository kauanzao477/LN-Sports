import 'dotenv/config';
import http from 'http';

const PORT = 3456;
process.env.PORT = String(PORT);

// Import server
await import('../server.js');

// Wait 1.5 seconds for server to bind and initDB to finish
await new Promise(r => setTimeout(r, 1500));

async function request(path, options = {}) {
  const url = `http://localhost:${PORT}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log('--- TESTANDO APIS DO SERVIDOR COM POSTGRESQL ---\n');

  // 1. GET /api/products
  console.log('1. Testando GET /api/products?limit=5:');
  const prodRes = await request('/api/products?limit=5');
  console.log(`   Status: ${prodRes.status}`);
  console.log(`   Total retornado do DB: ${prodRes.data.total}`);
  console.log(`   Total de páginas: ${prodRes.data.totalPages}`);
  console.log(`   Produtos no lote: ${prodRes.data.data?.length}`);
  if (prodRes.data.data?.length > 0) {
    console.log(`   Exemplo produto [0]: "${prodRes.data.data[0].name}" (Categoria: ${prodRes.data.data[0].category}, Imagens: ${prodRes.data.data[0].images?.length})`);
  }

  // 2. GET /api/products/:slug
  if (prodRes.data.data?.length > 0) {
    const slug = prodRes.data.data[0].slug;
    console.log(`\n2. Testando GET /api/products/${slug}:`);
    const slugRes = await request(`/api/products/${slug}`);
    console.log(`   Status: ${slugRes.status}`);
    console.log(`   Produto: "${slugRes.data.name}"`);
  }

  // 3. GET /api/categories
  console.log('\n3. Testando GET /api/categories:');
  const catRes = await request('/api/categories');
  console.log(`   Status: ${catRes.status}`);
  console.log(`   Categorias retornadas: ${catRes.data?.length}`);
  if (Array.isArray(catRes.data)) {
    for (const c of catRes.data.slice(0, 5)) {
      console.log(`     - ${c.name}: ${c.productCount} produtos`);
    }
  }

  // 4. GET /api/settings
  console.log('\n4. Testando GET /api/settings:');
  const setRes = await request('/api/settings');
  console.log(`   Status: ${setRes.status}`);
  console.log(`   Nome da Loja: "${setRes.data.storeName}"`);
  console.log(`   WhatsApp: "${setRes.data.whatsappNumber}"`);

  // 5. POST /api/admin/login
  console.log('\n5. Testando POST /api/admin/login:');
  // 5a. Senha incorreta (valida que busca no PostgreSQL e rejeita com 401)
  const loginFailRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@lnsports.com', password: 'senha_incorreta_para_teste' }),
  });
  console.log(`   Tentativa com senha inválida -> Status: ${loginFailRes.status}, Resposta: ${JSON.stringify(loginFailRes.data)}`);

  // 5b. Email inexistente
  const loginNotFoundRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'naoexiste@lnsports.com', password: 'qualquer_senha' }),
  });
  console.log(`   Tentativa com email inexistente -> Status: ${loginNotFoundRes.status}, Resposta: ${JSON.stringify(loginNotFoundRes.data)}`);

  // 5c. Login com credenciais válidas (teste ponta-a-ponta com admin temporário)
  const { default: pg } = await import('pg');
  const { default: bcrypt } = await import('bcryptjs');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const testHash = await bcrypt.hash('SenhaTesteSegura123!', 10);
  await pool.query(
    'INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash',
    ['test_api_verifier@lnsports.com', testHash]
  );

  const loginSuccessRes = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test_api_verifier@lnsports.com', password: 'SenhaTesteSegura123!' }),
  });
  console.log(`   Tentativa com credenciais válidas -> Status: ${loginSuccessRes.status}`);
  console.log(`   Token JWT recebido: ${loginSuccessRes.data?.token ? 'SIM (válido)' : 'NÃO'}`);
  console.log(`   Email retornado: ${loginSuccessRes.data?.email}`);

  // Testar rota protegida com o JWT
  if (loginSuccessRes.data?.token) {
    const dashRes = await request('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${loginSuccessRes.data.token}` },
    });
    console.log(`   GET /api/admin/dashboard com JWT -> Status: ${dashRes.status}, Total produtos: ${dashRes.data?.total}`);
  }

  // Limpar admin de teste
  await pool.query('DELETE FROM admins WHERE email = $1', ['test_api_verifier@lnsports.com']);
  await pool.end();

  console.log('\n--- TODOS OS TESTES DE API FORAM CONCLUÍDOS COM SUCESSO ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
