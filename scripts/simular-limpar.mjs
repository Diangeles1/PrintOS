// Apaga TODAS as contas criadas pelo simulador (teste+sim-*@printos.test).
// O cascade remove todos os dados dessas contas.
//
//   node scripts/simular-limpar.mjs

import { admin } from './_lib.mjs';

const ehSim = (email) => (email || '').startsWith('teste+sim-') && (email || '').endsWith('@printos.test');

const a = admin();
let apagados = 0;
let erros = 0;

for (let page = 1; page <= 50; page++) {
  const { data, error } = await a.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const sim = data.users.filter((u) => ehSim(u.email));
  for (const u of sim) {
    const r = await a.auth.admin.deleteUser(u.id);
    if (r.error) {
      erros++;
      console.log(`  ERRO ${u.email}: ${r.error.message}`);
    } else {
      apagados++;
      console.log(`  apagado ${u.email}`);
    }
  }
  if (data.users.length < 200) break;
}

console.log(`\n${apagados} conta(s) de simulação apagada(s)${erros ? `, ${erros} com erro` : ''}.`);
