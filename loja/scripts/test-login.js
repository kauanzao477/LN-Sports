import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runLoginTest() {
  console.log('=== TEST: Admin Authentication ===');
  const email = 'lnGSN@lnsports.com.br';
  const password = 'GSNlnsports@#2026';

  const envEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const envHash = process.env.ADMIN_PASSWORD_HASH;

  console.log('1. Checking .env configurations:');
  console.log('   - ADMIN_EMAIL:', envEmail);
  console.log('   - ADMIN_PASSWORD_HASH configured:', !!envHash);

  if (email.toLowerCase() !== envEmail) {
    throw new Error(`Email mismatch: expected ${envEmail}, got ${email}`);
  }

  const valid = await bcrypt.compare(password, envHash);
  console.log('2. Password validation against ADMIN_PASSWORD_HASH:', valid);
  if (!valid) {
    throw new Error('Password does NOT match ADMIN_PASSWORD_HASH!');
  }

  const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'ln-sports-dev-secret-change-in-prod';
  const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  const verified = jwt.verify(token, JWT_SECRET);

  console.log('3. JWT Token created and verified successfully:');
  console.log('   - Role:', verified.role);
  console.log('   - Email:', verified.email);
  console.log('   - Expires in:', verified.exp - verified.iat, 'seconds');

  console.log('\n🎉 ADMIN CREDENTIALS & AUTH VALIDATION PASSED 100%!');
}

runLoginTest().catch(err => {
  console.error('Login test failed:', err);
  process.exit(1);
});
