#!/usr/bin/env node
/**
 * Utilitário para gerar o hash bcrypt da senha do administrador.
 * Uso: node scripts/hash-senha.js SuaSenhaSegura123
 *
 * Cole o resultado como ADMIN_PASSWORD_HASH no arquivo loja/.env
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-senha.js SuaSenha');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log('\n✅  Hash gerado com sucesso!\n');
console.log('Cole no seu .env:');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
