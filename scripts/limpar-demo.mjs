// Apaga TODOS os dados de negócio de uma conta (não apaga a conta em si).
// Use depois do seed-demo, ou para zerar sua conta antes de lançar.
//
//   node scripts/limpar-demo.mjs voce@email.com
//
// Pede confirmação digitando o e-mail de novo.

import { createInterface } from 'node:readline/promises';
import { admin } from './_lib.mjs';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/limpar-demo.mjs <email-da-conta>');
  process.exit(2);
}

const a = admin();
let userId = null;
for (let page = 1; page <= 20 && !userId; page++) {
  const { data, error } = await a.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  const u = data.users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
  if (u) userId = u.id;
  if (data.users.length < 200) break;
}
if (!userId) {
  console.error(`Nenhum usuário com e-mail ${email}.`);
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const conf = await rl.question(`\nIsto APAGA todos os pedidos, orçamentos, clientes, caixa, etc. da conta ${email}.\nDigite o e-mail de novo para confirmar: `);
rl.close();
if (conf.trim().toLowerCase() !== email.toLowerCase()) {
  console.log('Cancelado.');
  process.exit(0);
}

// Ordem: filhos antes dos pais (mesmo com cascade, explícito é mais claro).
const tabelas = [
  'caixa_movimentos', 'caixa_sessoes',
  'pedido_arquivos', 'pedido_aprovacoes', 'pedido_itens', 'pedidos',
  'orcamento_itens', 'orcamentos',
  'whatsapp_pendentes', 'whatsapp_numeros', 'ingest_tokens',
  'servicos', 'materiais', 'clientes', 'empresa',
];

for (const t of tabelas) {
  const { error, count } = await a.from(t).delete({ count: 'exact' }).eq('user_id', userId);
  console.log(`  ${t}: ${error ? 'ERRO ' + error.message : (count ?? 0) + ' apagado(s)'}`);
}
console.log('\nConta zerada (o login continua existindo).');
