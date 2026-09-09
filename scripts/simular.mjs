// SIMULADOR DE OPERAÇÃO + CAÇA-BUGS
//
//   node scripts/simular.mjs [--contas 5] [--intervalo 1200] [--minutos 0] [--sem-caos]
//
// Cria N gráficas de teste (sim+*@printos.test) e fica gerando atividade
// realista ao vivo: pedidos (inclusive "chegando" pelo endpoint da extensão),
// orçamentos, aprovações de arte, movimento de caixa, avanço de produção e,
// de vez em quando, uma gráfica nova se cadastrando.
//
// Ao mesmo tempo dispara requisições malformadas contra os endpoints e o
// banco (payload gigante, unicode esquisito, número negativo, token expirado,
// duplo envio, enum inválido…) e registra QUALQUER resposta fora do esperado
// como BUG. Ctrl+C encerra e escreve scripts/_sim-relatorio.json.
//
// Limpar tudo depois:  node scripts/simular-limpar.mjs
//
// Precisa do dev server no ar (npm run dev) para a parte de endpoints.

import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { admin, novoUsuario, tokenIngest, APP_URL } from './_lib.mjs';

// ---- args ----
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const N_CONTAS = Math.max(1, Number(arg('--contas', 5)));
const INTERVALO = Math.max(150, Number(arg('--intervalo', 1200)));
const MINUTOS = Number(arg('--minutos', 0)); // 0 = até Ctrl+C
const CAOS = !process.argv.includes('--sem-caos');

// ---- estado ----
const contas = [];
const problemas = [];
const contagem = {};
let acoes = 0;
let rodando = true;

const agora = () => new Date().toLocaleTimeString('pt-BR');
const feed = (emoji, txt) => console.log(`\x1b[90m${agora()}\x1b[0m ${emoji} ${txt}`);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const inc = (k) => (contagem[k] = (contagem[k] || 0) + 1);
const dinheiro = () => rnd(15, 900) + Math.round(Math.random() * 100) / 100;

function bug(titulo, contexto = {}) {
  problemas.push({ quando: new Date().toISOString(), titulo, contexto });
  console.log(`\x1b[41m\x1b[97m BUG \x1b[0m \x1b[91m${titulo}\x1b[0m ${JSON.stringify(contexto)}`);
}

/** fetch com verificação: se o status não estiver na lista de esperados, é bug. */
async function req(rotulo, url, opts, esperados) {
  try {
    const r = await fetch(url, opts);
    let body = null;
    try {
      body = await r.json();
    } catch {
      /* sem corpo json */
    }
    if (!esperados.includes(r.status)) {
      bug(`${rotulo}: status ${r.status} (esperava ${esperados.join('/')})`, { url, body });
    }
    return { status: r.status, body };
  } catch (e) {
    bug(`${rotulo}: exceção de rede`, { url, erro: String(e) });
    return { status: 0, body: null };
  }
}

/** chamada ao banco: erro do PG só é ok se for um dos códigos esperados. */
function checaDb(rotulo, error, codigosOk = []) {
  if (error && !codigosOk.includes(error.code)) {
    bug(`${rotulo}: erro DB ${error.code || '?'}`, { msg: error.message });
    return false;
  }
  return !error;
}

// ---- catálogo de nomes ----
const FANTASIAS = ['Cores Vivas', 'Gráfica Expressa', 'Print Já', 'Arte & Papel', 'Impressos Sul',
  'Rápida Digital', 'Studio Gráfico Luz', 'Copiadora Central', 'Visual Card', 'Grafix'];
const SERVS = [['Cartão de visita', 'Impressão', 0.35, 'un'], ['Panfleto A5', 'Impressão', 0.28, 'un'],
  ['Banner lona', 'Comunicação visual', 65, 'm²'], ['Adesivo vinil', 'Comunicação visual', 45, 'm²'],
  ['Cópia P&B', 'Cópia', 0.5, 'un'], ['Cópia colorida', 'Cópia', 1.5, 'un'],
  ['Encadernação', 'Acabamento', 6, 'un'], ['Plastificação', 'Acabamento', 4, 'un'],
  ['Foto 10x15', 'Fotografia', 2.5, 'un'], ['Camiseta DTF', 'Personalizados', 39, 'un']];
const CLIS = ['Padaria do Zé', 'Studio Bella', 'Auto Peças Sol', 'Escola Crescer', 'Bar do Meio',
  'Imobiliária Lar', 'Academia Ação', 'Pet Focinho', 'Farmácia Vida', 'Loja Estilo', 'Mercado Bom',
  'Igreja Central', 'Salão Beleza Pura', 'Oficina do João', 'Buffet Sabor'];
const STEP = { aguardando_arte: 'em_producao', em_producao: 'pronto', pronto: 'entregue' };

// ---- setup de uma conta ----
async function criarConta(vitrine = false) {
  const u = await novoUsuario('sim');
  const fantasia = pick(FANTASIAS) + ' ' + randomBytes(2).toString('hex');
  await u.cli.from('empresa').upsert({ user_id: u.id, nome: fantasia });

  const nServ = rnd(4, 8);
  const { data: servicos } = await u.cli
    .from('servicos')
    .insert(SERVS.slice(0, nServ).map(([nome, categoria, preco, unidade]) => ({
      user_id: u.id, nome, categoria, preco, unidade, ativo: true,
    })))
    .select('id, nome, preco');

  const { data: clientes } = await u.cli
    .from('clientes')
    .insert(Array.from({ length: rnd(3, 6) }, () => ({ user_id: u.id, nome: pick(CLIS) })))
    .select('id, nome');

  const tk = tokenIngest();
  await u.cli.from('ingest_tokens').insert({ token_hash: tk.hash, label: 'simulador' });

  const conta = {
    ...u, fantasia,
    servicos: servicos || [],
    clientes: clientes || [],
    pedidos: [],
    orcamentos: [],
    caixaId: null,
    token: tk.texto,
    vitrine,
  };
  contas.push(conta);
  feed(vitrine ? '⭐' : '🏢', `Gráfica "${fantasia}" cadastrada${vitrine ? '  <<< CONTA DE VITRINE' : ''}`);
  return conta;
}

// ---- ações normais ----
async function aNovoCliente(c) {
  const nome = pick(CLIS) + ' ' + rnd(1, 99);
  const { data, error } = await c.cli.from('clientes').insert({ user_id: c.id, nome }).select('id, nome').single();
  if (checaDb('novoCliente', error)) {
    c.clientes.push(data);
    feed('👤', `${c.fantasia}: cliente "${nome}"`);
    inc('cliente');
  }
}

async function aNovoOrcamento(c) {
  const cli = pick(c.clientes);
  const { data: o, error } = await c.cli
    .from('orcamentos')
    .insert({ user_id: c.id, cliente_id: cli.id, cliente_nome: cli.nome, status: pick(['rascunho', 'enviado', 'enviado']) })
    .select('id, numero').single();
  if (!checaDb('novoOrcamento', error)) return;
  const itens = Array.from({ length: rnd(1, 4) }, () => {
    const s = pick(c.servicos);
    return { orcamento_id: o.id, descricao: s.nome, quantidade: rnd(1, 300), preco_unitario: s.preco };
  });
  const { error: e2 } = await c.cli.from('orcamento_itens').insert(itens);
  checaDb('novoOrcamento.itens', e2);
  c.orcamentos.push(o.id);
  feed('📄', `${c.fantasia}: orçamento #${o.numero} (${itens.length} itens)`);
  inc('orcamento');
}

async function aAprovarGerar(c) {
  if (!c.orcamentos.length) return;
  const oid = c.orcamentos.shift();
  await c.cli.from('orcamentos').update({ status: 'aprovado' }).eq('id', oid);
  const { data: pedId, error } = await c.cli.rpc('gerar_pedido_do_orcamento', { p_orcamento_id: oid });
  if (checaDb('gerar_pedido_do_orcamento', error) && pedId) {
    c.pedidos.push({ id: pedId, status: 'aguardando_arte' });
    feed('✅', `${c.fantasia}: orçamento aprovado → pedido gerado`);
    inc('pedido_de_orcamento');
  }
}

async function aPedidoBalcao(c) {
  const cli = Math.random() < 0.7 ? pick(c.clientes) : null;
  const forma = pick(['dinheiro', 'pix', 'debito', 'credito']);
  const { data: p, error } = await c.cli
    .from('pedidos')
    .insert({ user_id: c.id, cliente_id: cli?.id ?? null, cliente_nome: cli?.nome ?? 'Venda balcão', status: 'entregue', forma_pagamento: forma, origem: 'venda_rapida' })
    .select('id, numero').single();
  if (!checaDb('pedidoBalcao', error)) return;
  const itens = Array.from({ length: rnd(1, 3) }, () => {
    const s = pick(c.servicos);
    return { pedido_id: p.id, descricao: s.nome, quantidade: rnd(1, 200), preco_unitario: s.preco };
  });
  checaDb('pedidoBalcao.itens', (await c.cli.from('pedido_itens').insert(itens)).error);
  if (c.caixaId) {
    const { error: e3 } = await c.cli.from('caixa_movimentos').insert({
      user_id: c.id, sessao_id: c.caixaId, tipo: 'entrada', categoria: 'Venda', descricao: `Venda balcão · #${p.numero}`, valor: dinheiro(),
    });
    checaDb('pedidoBalcao.caixa', e3, ['P0001']); // P0001 = raise do trigger se a sessão fechou na corrida (ok)
  }
  feed('💰', `${c.fantasia}: venda balcão #${p.numero} (${forma})`);
  inc('venda_balcao');
}

async function aPedidoWhatsapp(c) {
  const r = await req('ingest/pedido', `${APP_URL}/api/ingest/pedido`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token, Origin: 'chrome-extension://sim' },
    body: JSON.stringify({
      cliente: pick(c.clientes)?.nome ?? 'Cliente WhatsApp',
      itens: [{ descricao: pick(c.servicos).nome, quantidade: rnd(1, 50) }],
      valor: dinheiro(),
      forma_pagamento: pick(['dinheiro', 'pix', 'debito', 'credito', 'outro']),
      texto: 'oi, preciso desse pedido pra amanhã 🙏',
    }),
  }, [201, 429]); // 429 = rate limit (esperado sob carga)
  if (r.status === 201) {
    c.pedidos.push({ id: r.body.id, status: 'aguardando_arte' });
    feed('📱', `${c.fantasia}: PEDIDO CHEGANDO pelo WhatsApp → #${r.body?.numero ?? '?'}`);
    inc('pedido_whatsapp');
  } else if (r.status === 429) {
    feed('⏳', `${c.fantasia}: rate limit do ingest atingido (esperado)`);
    inc('ingest_429');
  }
}

async function aAvancarProducao(c) {
  const abertos = c.pedidos.filter((p) => STEP[p.status]);
  if (!abertos.length) return;
  const p = pick(abertos);
  const novo = STEP[p.status];
  const { error } = await c.cli.from('pedidos').update({ status: novo }).eq('id', p.id);
  if (checaDb('avancarProducao', error)) {
    p.status = novo;
    feed('🏭', `${c.fantasia}: pedido → ${novo.replace('_', ' ')}`);
    inc('avanco_producao');
  }
}

async function aCaixa(c) {
  if (c.caixaId) {
    const { error } = await c.cli.from('caixa_sessoes').update({ status: 'fechado', valor_fechamento: dinheiro() * 5 }).eq('id', c.caixaId);
    if (checaDb('fecharCaixa', error)) {
      feed('🔒', `${c.fantasia}: caixa fechado`);
      c.caixaId = null;
      inc('caixa_fecha');
    }
  } else {
    const { data, error } = await c.cli.from('caixa_sessoes').insert({ user_id: c.id, valor_abertura: rnd(50, 300) }).select('id').single();
    if (checaDb('abrirCaixa', error, ['23505'])) { // 23505 se já tinha uma aberta (corrida) — ok
      c.caixaId = data.id;
      feed('🔓', `${c.fantasia}: caixa aberto`);
      inc('caixa_abre');
    }
  }
}

async function aAprovacaoArte(c) {
  const alvo = c.pedidos.find((p) => p.status === 'aguardando_arte');
  if (!alvo) return;
  const token = randomBytes(24).toString('hex');
  const { error } = await c.cli.from('pedido_aprovacoes').insert({ user_id: c.id, pedido_id: alvo.id, token });
  if (!checaDb('linkAprovacao', error)) return;
  const decisao = pick(['aprovado', 'aprovado', 'alteracao', 'recusado']);
  const r = await req('aprovacao', `${APP_URL}/api/aprovacao/${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao, comentario: decisao === 'aprovado' ? '' : 'trocar o telefone, por favor', respondente: 'Cliente' }),
  }, [200]);
  if (r.status === 200) {
    if (decisao === 'aprovado') alvo.status = 'em_producao';
    feed('🖼️', `${c.fantasia}: cliente respondeu a arte → ${decisao}`);
    inc('resposta_arte_' + decisao);
  }
}

// ---- caça-bugs (chaos) ----
async function caos(c) {
  const probes = [
    // ingest sem auth
    () => req('caos:ingest sem token', `${APP_URL}/api/ingest/pedido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"cliente":"x","itens":[{"descricao":"y"}]}',
    }, [401]),
    // ingest token lixo
    () => req('caos:ingest token lixo', `${APP_URL}/api/ingest/pedido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pit_' + 'z'.repeat(40) }, body: '{"cliente":"x","itens":[]}',
    }, [401]),
    // ingest json quebrado
    () => req('caos:ingest json quebrado', `${APP_URL}/api/ingest/pedido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token }, body: '{isso nao e json',
    }, [400]),
    // ingest descricao gigante + unicode + negativo
    () => req('caos:ingest campos extremos', `${APP_URL}/api/ingest/pedido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token },
      body: JSON.stringify({ cliente: '𝕏'.repeat(500) + '💥"; drop table pedidos;--', itens: [{ descricao: 'a'.repeat(5000), quantidade: -50, preco_unitario: -1 }], valor: -999, prazo: 'ontem' }),
    }, [201]), // deve aceitar sanitizando (não 500)
    // ingest arquivo com mime proibido
    () => req('caos:ingest svg (mime bloqueado)', `${APP_URL}/api/ingest/pedido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token },
      body: JSON.stringify({ cliente: 'x', itens: [{ descricao: 'y' }], arquivo: { nome: 'x.svg', mime: 'image/svg+xml', base64: Buffer.from('<svg onload=alert(1)>').toString('base64') } }),
    }, [201]),
    // aprovacao token invalido
    () => req('caos:aprovacao token curto', `${APP_URL}/api/aprovacao/xyz`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"decisao":"aprovado"}',
    }, [400]),
    // aprovacao decisao invalida
    () => req('caos:aprovacao decisao invalida', `${APP_URL}/api/aprovacao/${randomBytes(24).toString('hex')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"decisao":"talvez"}',
    }, [400, 404]),
    // NOTA: nada de sondar /api/admin aqui. Um falso-negativo nesse endpoint
    // causa dano real (banir/apagar conta). O gate do admin é testado
    // isoladamente com curl, nunca por um runner automático em concorrência.
    // DB: enum de status invalido
    async () => {
      const { error } = await c.cli.from('pedidos').insert({ user_id: c.id, status: 'explodido', cliente_nome: 'x' });
      if (!error) bug('caos:DB aceitou status invalido em pedidos');
      else if (error.code !== '23514') bug('caos:DB erro inesperado em status invalido', { code: error.code });
    },
    // DB: forma_pagamento fora da lista
    async () => {
      const { error } = await c.cli.from('pedidos').insert({ user_id: c.id, cliente_nome: 'x', forma_pagamento: 'bitcoin' });
      if (!error) bug('caos:DB aceitou forma_pagamento invalida');
    },
    // DB: roubar user_id de outra conta
    async () => {
      const outra = contas.find((x) => x.id !== c.id);
      if (!outra) return;
      const { data, error } = await c.cli.from('clientes').insert({ user_id: outra.id, nome: 'roubo' }).select();
      if (!error && data?.length) bug('caos:RLS deixou inserir cliente no user_id de outra conta!', { alvo: outra.id });
    },
    // DB: ler pedidos de outra conta
    async () => {
      const outra = contas.find((x) => x.id !== c.id);
      if (!outra) return;
      const { data } = await c.cli.from('pedidos').select('id').eq('user_id', outra.id).limit(5);
      if (data && data.length) bug('caos:RLS vazou pedidos de outra conta!', { qtd: data.length });
    },
  ];
  await pick(probes)();
  inc('caos');
}

// ---- loop ----
const ACOES = [
  [aPedidoWhatsapp, 5], [aPedidoBalcao, 4], [aAvancarProducao, 4], [aAprovacaoArte, 3],
  [aNovoOrcamento, 3], [aAprovarGerar, 2], [aNovoCliente, 2], [aCaixa, 1],
];
function sorteiaAcao() {
  const total = ACOES.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [fn, w] of ACOES) {
    if ((r -= w) <= 0) return fn;
  }
  return ACOES[0][0];
}

function relatorio() {
  console.log('\n\x1b[1m===== RELATÓRIO DA SIMULAÇÃO =====\x1b[0m');
  console.log(`Contas: ${contas.length}  |  Ações: ${acoes}  |  Duração: rodou até parar`);
  console.log('\nAtividade:');
  for (const [k, v] of Object.entries(contagem).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\n\x1b[1mBUGS / ANOMALIAS: ${problemas.length}\x1b[0m`);
  for (const p of problemas) console.log(`  \x1b[91m•\x1b[0m ${p.titulo}  ${JSON.stringify(p.contexto).slice(0, 200)}`);
  const rel = {
    gerado_em: new Date().toISOString(),
    contas: contas.map((c) => ({ email: c.email, fantasia: c.fantasia })),
    acoes, contagem, problemas,
  };
  writeFileSync(new URL('./_sim-relatorio.json', import.meta.url), JSON.stringify(rel, null, 2));
  console.log('\nRelatório salvo em scripts/_sim-relatorio.json');
  console.log('Limpar as contas de teste:  node scripts/simular-limpar.mjs');
}

process.on('SIGINT', () => {
  if (!rodando) process.exit(1);
  rodando = false;
  console.log('\n\x1b[93mParando…\x1b[0m');
});

// ---- main ----
console.log(`\x1b[1mSIMULADOR PrintOS\x1b[0m — ${N_CONTAS} contas, 1 ação a cada ${INTERVALO}ms${CAOS ? ', com caça-bugs' : ''}`);
console.log(`Endpoints em ${APP_URL} (dev server precisa estar no ar)\n`);

const vitrine = await criarConta(true);
console.log(`\n\x1b[92m>>> LOGIN DE VITRINE:  ${vitrine.email}   senha:  ${vitrine.senha}\x1b[0m`);
console.log('    Entre com esse login para ver pedidos/produção/caixa enchendo em tempo real.');
console.log('    E abra /admin para ver as contas e os números subindo.\n');

for (let i = 1; i < N_CONTAS; i++) await criarConta();

const fim = MINUTOS > 0 ? Date.now() + MINUTOS * 60_000 : Infinity;
while (rodando && Date.now() < fim) {
  acoes++;
  const c = Math.random() < 0.45 ? vitrine : pick(contas); // vitrine recebe mais movimento
  try {
    if (CAOS && acoes % 7 === 0) await caos(c);
    else await sorteiaAcao()(c);
    if (acoes % 45 === 0) await criarConta(); // nova gráfica se cadastrando
  } catch (e) {
    bug('exceção não tratada no loop', { erro: String(e), stack: e?.stack?.split('\n')[1] });
  }
  await new Promise((r) => setTimeout(r, INTERVALO));
}

relatorio();
process.exit(problemas.length ? 1 : 0);
