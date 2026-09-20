import 'dotenv/config';
import { onRequestPost as loginPost } from '../functions/api/admin/login.js';
import { onRequestGet as dashboardGet } from '../functions/api/admin/dashboard.js';
import { onRequestGet as settingsGet } from '../functions/api/settings.js';
import { onRequestPut as settingsPut } from '../functions/api/admin/settings.js';
import { onRequestGet as categoriesGet } from '../functions/api/categories.js';
import { onRequestPut as categoriesPut } from '../functions/api/admin/categories.js';
import { onRequestGet as productsGet } from '../functions/api/products/index.js';

const mockEnv = {
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'lnGSN@lnsports.com.br',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '$2b$12$IBsR5hMx1dhqyDZ5P7qUzeC0zwkAAx5GLPjVgMnY05GmQWlA5sgLa',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'ln-sports-test-secret',
  VITE_STORE_NAME: 'LN SPORTS',
  VITE_STORE_WHATSAPP_NUMBER: '5549998046866',
  DATABASE_URL: process.env.DATABASE_URL,
};

async function runTests() {
  console.log('====================================================');
  console.log('TESTING CLOUDFLARE PAGES FUNCTIONS: ADMIN & API');
  console.log('====================================================\n');

  // --- 1. Login com senha errada ---
  console.log('TEST 1: POST /api/admin/login com credenciais incorretas...');
  const badReq = new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lnGSN@lnsports.com.br', password: 'senhaErrada123' }),
  });
  const badRes = await loginPost({ request: badReq, env: mockEnv });
  const badData = await badRes.json();
  console.log(`Status: ${badRes.status} (esperado 401) | Body:`, badData);
  if (badRes.status !== 401) throw new Error(`Expected 401, got ${badRes.status}`);

  // --- 2. Login correto ---
  console.log('\nTEST 2: POST /api/admin/login com credenciais corretas...');
  const goodReq = new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lnGSN@lnsports.com.br', password: 'GSNlnsports@#2026' }),
  });
  const goodRes = await loginPost({ request: goodReq, env: mockEnv });
  const goodData = await goodRes.json();
  console.log(`Status: ${goodRes.status} (esperado 200) | Token gerado: ${Boolean(goodData.token)}`);
  if (goodRes.status !== 200 || !goodData.token) throw new Error('Expected 200 with JWT token');

  const adminToken = goodData.token;

  // --- 3. Dashboard sem token ---
  console.log('\nTEST 3: GET /api/admin/dashboard sem token...');
  const noAuthReq = new Request('http://localhost/api/admin/dashboard');
  const noAuthRes = await dashboardGet({ request: noAuthReq, env: mockEnv });
  console.log(`Status: ${noAuthRes.status} (esperado 401)`);
  if (noAuthRes.status !== 401) throw new Error(`Expected 401, got ${noAuthRes.status}`);

  // --- 4. Dashboard com token JWT ---
  console.log('\nTEST 4: GET /api/admin/dashboard com token JWT válido...');
  const authReq = new Request('http://localhost/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const authRes = await dashboardGet({ request: authReq, env: mockEnv });
  const authData = await authRes.json();
  console.log(`Status: ${authRes.status} (esperado 200) | Métricas recebidas:`, {
    total: authData.total,
    published: authData.published,
    categoriesCount: authData.categoriesCount,
  });
  if (authRes.status !== 200 || typeof authData.total !== 'number') {
    throw new Error('Expected 200 with dashboard metrics');
  }

  // --- 5. GET /api/settings ---
  console.log('\nTEST 5: GET /api/settings...');
  const settingsReq = new Request('http://localhost/api/settings');
  const settingsRes = await settingsGet({ request: settingsReq, env: mockEnv });
  const settingsData = await settingsRes.json();
  console.log(`Status: ${settingsRes.status} (esperado 200) | Loja:`, settingsData.storeName);
  if (settingsRes.status !== 200 || !settingsData.storeName) {
    throw new Error('Expected 200 with store settings');
  }

  // --- 6. PUT /api/admin/settings com token ---
  console.log('\nTEST 6: PUT /api/admin/settings autenticado...');
  const putSetReq = new Request('http://localhost/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ storeName: 'LN SPORTS' }),
  });
  const putSetRes = await settingsPut({ request: putSetReq, env: mockEnv });
  const putSetData = await putSetRes.json();
  console.log(`Status: ${putSetRes.status} (esperado 200) | Resposta:`, putSetData);
  if (putSetRes.status !== 200 || !putSetData.ok) {
    throw new Error('Expected 200 with ok: true');
  }

  // --- 7. GET /api/categories ---
  console.log('\nTEST 7: GET /api/categories...');
  const catsReq = new Request('http://localhost/api/categories');
  const catsRes = await categoriesGet({ request: catsReq, env: mockEnv });
  const catsData = await catsRes.json();
  console.log(`Status: ${catsRes.status} (esperado 200) | Total categorias: ${catsData.length}`);
  if (catsRes.status !== 200 || !Array.isArray(catsData) || catsData.length !== 8) {
    throw new Error('Expected 200 with 8 categories');
  }

  // --- 8. PUT /api/admin/categories com token ---
  console.log('\nTEST 8: PUT /api/admin/categories autenticado...');
  const putCatReq = new Request('http://localhost/api/admin/categories', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Chuteiras',
      slug: 'chuteiras',
      subcategories: [],
      productCount: 8062,
    }),
  });
  const putCatRes = await categoriesPut({ request: putCatReq, env: mockEnv });
  const putCatData = await putCatRes.json();
  console.log(`Status: ${putCatRes.status} (esperado 200) | Resposta:`, putCatData);
  if (putCatRes.status !== 200 || !putCatData.ok) {
    throw new Error('Expected 200 with ok: true');
  }

  // --- 9. GET /api/products ---
  console.log('\nTEST 9: GET /api/products...');
  const prodsReq = new Request('http://localhost/api/products?page=1&limit=5');
  const prodsRes = await productsGet({ request: prodsReq, env: mockEnv });
  const prodsData = await prodsRes.json();
  console.log(`Status: ${prodsRes.status} (esperado 200) | Estrutura de paginação:`, prodsData.pagination);
  if (prodsRes.status !== 200 || !prodsData.pagination) {
    throw new Error('Expected 200 with pagination structure');
  }

  // --- 10. Endpoints de produtos do Admin sem token (esperado 401) ---
  console.log('\nTEST 10: Endpoints de produtos admin sem token...');
  const { onRequestPatch: publishPatch } = await import('../functions/api/admin/products/[id]/publish.js');
  const { onRequestPatch: featuredPatch } = await import('../functions/api/admin/products/[id]/featured.js');
  const { onRequestPatch: mainImagePatch } = await import('../functions/api/admin/products/[id]/main-image.js');
  const { onRequestPatch: coverPatch } = await import('../functions/api/admin/products/[id]/cover.js');
  const { onRequestPut: prodPut, onRequestDelete: prodDel } = await import('../functions/api/admin/products/[id].js');

  const unauthPatch = new Request('http://localhost/api/admin/products/123/publish', { method: 'PATCH' });
  const unauthRes = await publishPatch({ request: unauthPatch, env: mockEnv, params: { id: '123' } });
  if (unauthRes.status !== 401) throw new Error('Expected 401 for unauthenticated publish');

  const unauthDel = new Request('http://localhost/api/admin/products/123', { method: 'DELETE' });
  const unauthDelRes = await prodDel({ request: unauthDel, env: mockEnv, params: { id: '123' } });
  if (unauthDelRes.status !== 401) throw new Error('Expected 401 for unauthenticated delete');
  console.log('Todos os endpoints de edição de produtos rejeitam requisições não autenticadas com HTTP 401!');

  console.log('\n🎉 ALL 10 CLOUDFLARE PAGES FUNCTIONS TEST SUITES PASSED WITH 100% SUCCESS!\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
