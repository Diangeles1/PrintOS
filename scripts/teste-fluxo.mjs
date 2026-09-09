// Fluxo de negócio ponta-a-ponta numa conta só: valida triggers, RPC,
// colunas geradas e os endpoints públicos (ingestão + aprovação).
//
//   node scripts/teste-fluxo.mjs
//
// Precisa do dev server no ar (npm run dev) para a parte de endpoints.
// Cria/apaga um usuário teste+fluxo-*@printos.test.

import { admin, novoUsuario, apagarUsuario, tokenIngest, tokenAprovacao, criarPlacar, APP_URL } from './_lib.mjs';

const P = criarPlacar('Fluxo de negócio ponta-a-ponta');
let U;

const money = (n) => Math.round(Number(n) * 100) / 100;

try {
  U = await novoUsuario('fluxo');
  const db = U.cli;
  console.log(`  conta = ${U.id}\n`);

  // 1) cadastros base
  await db.from('empresa').upsert({ user_id: U.id, nome: 'Gráfica do Teste' });
  const { data: servico } = await db
    .from('servicos').insert({ nome: 'Cartão de visita', preco: 10, unidade: 'un' }).select().single();
  const { data: cliente } = await db
    .from('clientes').insert({ nome: 'Padaria Pão Quente' }).select().single();
  P.check('cadastros base criados', !!servico && !!cliente);

  // 2) orçamento + itens: numero sequencial, subtotal (trigger) e total (coluna gerada)
  const { data: orc, error: eOrc } = await db
    .from('orcamentos').insert({ cliente_id: cliente.id, cliente_nome: cliente.nome }).select().single();
  P.check('orçamento criado', !eOrc, eOrc?.message);
  P.check('orçamento recebeu numero >= 1', (orc?.numero ?? 0) >= 1, `numero=${orc?.numero}`);

  await db.from('orcamento_itens').insert([
    { orcamento_id: orc.id, descricao: 'Cartão 4x4', quantidade: 3, preco_unitario: 10 },
    { orcamento_id: orc.id, descricao: 'Arte', quantidade: 1, preco_unitario: 5 },
  ]);
  let { data: orc2 } = await db.from('orcamentos').select('subtotal,total,desconto').eq('id', orc.id).single();
  P.check('subtotal recalculado (trigger) = 35', money(orc2.subtotal) === 35, `subtotal=${orc2.subtotal}`);
  P.check('total (coluna gerada) = 35', money(orc2.total) === 35, `total=${orc2.total}`);

  await db.from('orcamentos').update({ desconto: 5 }).eq('id', orc.id);
  ({ data: orc2 } = await db.from('orcamentos').select('total').eq('id', orc.id).single());
  P.check('desconto aplicado: total = 30', money(orc2.total) === 30, `total=${orc2.total}`);

  // 3) aprovar orçamento e gerar pedido via RPC
  await db.from('orcamentos').update({ status: 'aprovado' }).eq('id', orc.id);
  const { data: novoPedidoId, error: eRpc } = await db.rpc('gerar_pedido_do_orcamento', { p_orcamento_id: orc.id });
  P.check('RPC gerar_pedido_do_orcamento retornou id', !eRpc && !!novoPedidoId, eRpc?.message);

  if (novoPedidoId) {
    const { data: ped } = await db.from('pedidos').select('*').eq('id', novoPedidoId).single();
    const { data: pItens } = await db.from('pedido_itens').select('*').eq('pedido_id', novoPedidoId);
    P.check('pedido gerado aponta para o orçamento', ped?.orcamento_id === orc.id);
    P.check('itens clonados (2)', (pItens?.length ?? 0) === 2, `itens=${pItens?.length}`);
    P.check('subtotal do pedido = 35', money(ped?.subtotal) === 35, `subtotal=${ped?.subtotal}`);
  }

  // 4) caixa: sessão aberta, movimento, fechamento, e bloqueios
  const { data: sessao, error: eS } = await db
    .from('caixa_sessoes').insert({ valor_abertura: 100 }).select().single();
  P.check('caixa: sessão aberta', !eS && sessao?.status === 'aberto', eS?.message);

  const seg = await db.from('caixa_sessoes').insert({ valor_abertura: 0 }).select().single();
  P.check('caixa: NÃO abre 2ª sessão simultânea', !!seg.error, seg.error ? '' : 'abriu duas');

  const { error: eMov } = await db.from('caixa_movimentos').insert({
    sessao_id: sessao.id, tipo: 'entrada', categoria: 'Venda', descricao: 'Venda teste', valor: 50,
  });
  P.check('caixa: movimento em sessão aberta OK', !eMov, eMov?.message);

  await db.from('caixa_sessoes').update({ status: 'fechado', valor_fechamento: 150 }).eq('id', sessao.id);
  const movFechado = await db.from('caixa_movimentos').insert({
    sessao_id: sessao.id, tipo: 'entrada', categoria: 'Venda', descricao: 'Depois de fechar', valor: 10,
  });
  P.check('caixa: NÃO aceita movimento em sessão fechada (trigger)', !!movFechado.error,
    movFechado.error ? '' : 'aceitou');

  // 5) endpoint de ingestão (extensão do WhatsApp)
  const tk = tokenIngest();
  await db.from('ingest_tokens').insert({ token_hash: tk.hash, label: 'teste-fluxo' });
  let ingOK = false;
  let pedidoIngestId = null;
  try {
    const r = await fetch(`${APP_URL}/api/ingest/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk.texto, Origin: 'chrome-extension://teste' },
      body: JSON.stringify({ cliente: 'Cliente WhatsApp', itens: [{ descricao: 'Banner 2x1' }], valor: 90, forma_pagamento: 'pix' }),
    });
    const j = await r.json().catch(() => ({}));
    ingOK = r.status === 201 && j.ok;
    pedidoIngestId = j.id;
    P.check('endpoint /api/ingest cria pedido (201)', ingOK, `status=${r.status} ${JSON.stringify(j)}`);
  } catch (e) {
    P.check('endpoint /api/ingest acessível (dev server no ar?)', false, e.message);
  }
  // token ruim -> 401
  try {
    const r = await fetch(`${APP_URL}/api/ingest/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer pit_naoexiste000000000000', Origin: 'chrome-extension://x' },
      body: JSON.stringify({ cliente: 'x', itens: [{ descricao: 'y' }] }),
    });
    P.check('endpoint /api/ingest rejeita token inválido (401)', r.status === 401, `status=${r.status}`);
  } catch { /* dev server off — já reportado acima */ }

  // 6) endpoint de aprovação de arte
  const alvoPedido = pedidoIngestId || novoPedidoId;
  if (alvoPedido) {
    await db.from('pedidos').update({ status: 'aguardando_arte' }).eq('id', alvoPedido);
    const tkApv = tokenAprovacao();
    const { error: eApv } = await db.from('pedido_aprovacoes').insert({ pedido_id: alvoPedido, token: tkApv });
    P.check('link de aprovação criado', !eApv, eApv?.message);
    try {
      const r1 = await fetch(`${APP_URL}/api/aprovacao/${tkApv}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'aprovado', respondente: 'Cliente Teste' }),
      });
      P.check('aprovação: 1ª resposta aceita (200)', r1.status === 200, `status=${r1.status}`);
      const { data: pedApv } = await db.from('pedidos').select('status').eq('id', alvoPedido).single();
      P.check('aprovação move pedido para em_producao', pedApv?.status === 'em_producao', `status=${pedApv?.status}`);
      const r2 = await fetch(`${APP_URL}/api/aprovacao/${tkApv}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao: 'recusado', comentario: 'tentando de novo' }),
      });
      P.check('aprovação: 2ª resposta barrada (409)', r2.status === 409, `status=${r2.status}`);
    } catch (e) {
      P.check('endpoint /api/aprovacao acessível', false, e.message);
    }
  }
} catch (e) {
  console.error('\nERRO FATAL:', e.message);
  P.check('execução sem erro fatal', false, e.message);
} finally {
  await apagarUsuario(U?.id);
  console.log('\n(usuário de teste apagado — dados em cascata)');
}

process.exit(P.fim() ? 0 : 1);
