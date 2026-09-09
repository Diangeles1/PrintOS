// Enche a conta de UMA gráfica com dados realistas pra você navegar o
// sistema "cheio" antes de lançar (dashboard, produção, listas, caixa).
//
//   node scripts/seed-demo.mjs voce@email.com
//
// Usa service_role (ignora RLS) e grava com user_id explícito. Idempotência
// leve: cria sempre linhas novas — rode 1x, ou limpe antes com limpar-demo.

import { admin } from './_lib.mjs';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/seed-demo.mjs <email-da-conta>');
  process.exit(2);
}

const a = admin();

// acha o usuário pelo e-mail
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
console.log(`Semeando dados para ${email} (${userId})…\n`);

const hoje = new Date();
const dia = (delta) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const U = { user_id: userId };

// ---- clientes ----
const nomesCli = [
  'Padaria Pão Quente', 'Studio Bella Foto', 'Auto Peças Girassol', 'Escola Crescer',
  'Restaurante Tempero Bom', 'Imobiliária Lar Certo', 'Academia Corpo & Ação',
  'Pet Shop Focinho Feliz', 'Farmácia Vida', 'Loja Estilo Único', 'Marcenaria Nogueira',
  'Igreja Batista Central',
];
const { data: clientes } = await a
  .from('clientes')
  .insert(nomesCli.map((nome, i) => ({
    ...U, nome,
    telefone: `79${String(98800000 + i * 137).slice(0, 8)}`,
    documento: null,
  })))
  .select('id, nome');
console.log(`  ${clientes.length} clientes`);

// ---- serviços ----
const servs = [
  ['Cartão de visita', 'Impressão', 0.35, 'un'], ['Panfleto A5 4x4', 'Impressão', 0.28, 'un'],
  ['Banner lona 440g', 'Comunicação visual', 65, 'm²'], ['Adesivo vinil', 'Comunicação visual', 45, 'm²'],
  ['Impressão A4 colorida', 'Cópia', 1.5, 'un'], ['Impressão A4 P&B', 'Cópia', 0.5, 'un'],
  ['Encadernação espiral', 'Acabamento', 6, 'un'], ['Plastificação A4', 'Acabamento', 4, 'un'],
];
const { data: servicos } = await a
  .from('servicos')
  .insert(servs.map(([nome, categoria, preco, unidade]) => ({ ...U, nome, categoria, preco, unidade, ativo: true })))
  .select('id, nome, preco');
console.log(`  ${servicos.length} serviços`);

// ---- materiais ----
const mats = [
  ['Papel couché 250g A3', 500, 50, 0.4], ['Lona 440g (rolo)', 3, 1, 180],
  ['Vinil adesivo (rolo)', 2, 1, 140], ['Espiral 17mm (cx)', 8, 3, 22],
  ['Toner preto', 1, 2, 320], ['Papel sulfite A4 (resma)', 12, 4, 24],
];
await a.from('materiais').insert(mats.map(([nome, estoque, estoque_minimo, custo]) => ({
  ...U, nome, estoque, estoque_minimo, custo,
})));
console.log(`  ${mats.length} materiais`);

// ---- caixa aberto + movimentos ----
const { data: sessao } = await a
  .from('caixa_sessoes').insert({ ...U, valor_abertura: 200, status: 'aberto' }).select('id').single();
await a.from('caixa_movimentos').insert([
  { ...U, sessao_id: sessao.id, tipo: 'entrada', categoria: 'Venda', descricao: 'Venda rápida · balcão', valor: 47.5 },
  { ...U, sessao_id: sessao.id, tipo: 'entrada', categoria: 'Venda', descricao: 'Venda rápida · balcão', valor: 12 },
  { ...U, sessao_id: sessao.id, tipo: 'saida', categoria: 'Despesa', descricao: 'Almoço equipe', valor: 60 },
]);
console.log('  1 caixa aberto + 3 movimentos');

// ---- orçamentos ----
const statusOrc = ['rascunho', 'enviado', 'enviado', 'aprovado', 'recusado'];
let nOrc = 0;
for (const st of statusOrc) {
  const c = pick(clientes);
  const { data: o } = await a
    .from('orcamentos').insert({ ...U, cliente_id: c.id, cliente_nome: c.nome, status: st, validade: dia(15) })
    .select('id').single();
  const linhas = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
    const s = pick(servicos);
    return { ...U, orcamento_id: o.id, descricao: s.nome, quantidade: 1 + Math.floor(Math.random() * 30), preco_unitario: s.preco };
  });
  const { error: eOi } = await a.from('orcamento_itens').insert(linhas);
  if (eOi) throw new Error(`orcamento_itens: ${eOi.message}`);
  nOrc++;
}
console.log(`  ${nOrc} orçamentos`);

// ---- pedidos (todos os status, prazos variados) ----
const plano = [
  ...Array(5).fill('aguardando_arte'), ...Array(5).fill('em_producao'),
  ...Array(3).fill('pronto'), ...Array(6).fill('entregue'), ...Array(2).fill('cancelado'),
];
let nPed = 0;
for (const st of plano) {
  const c = pick(clientes);
  const prazo = st === 'entregue' || st === 'cancelado'
    ? dia(-Math.floor(Math.random() * 10))
    : pick([dia(-3), dia(-1), dia(0), dia(0), dia(2), dia(5), null]);
  const { data: p } = await a
    .from('pedidos').insert({
      ...U, cliente_id: c.id, cliente_nome: c.nome, status: st, prazo,
      forma_pagamento: st === 'entregue' ? pick(['dinheiro', 'pix', 'debito', 'credito']) : null,
      origem: pick(['manual', 'manual', 'venda_rapida', 'whatsapp_ext']),
    })
    .select('id').single();
  const linhas = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
    const s = pick(servicos);
    return { ...U, pedido_id: p.id, descricao: s.nome, quantidade: 1 + Math.floor(Math.random() * 40), preco_unitario: s.preco };
  });
  const { error: ePi } = await a.from('pedido_itens').insert(linhas);
  if (ePi) throw new Error(`pedido_itens: ${ePi.message}`);
  nPed++;
}
console.log(`  ${nPed} pedidos com itens`);

console.log('\nPronto. Abra o dashboard, a Produção e o Caixa para ver tudo cheio.');
console.log('Para limpar depois: node scripts/limpar-demo.mjs ' + email);
