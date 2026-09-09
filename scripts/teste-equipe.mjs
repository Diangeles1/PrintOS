// Sistema de equipe: o funcionário vende e cadastra produto, mas NÃO toca no
// caixa, orçamentos, config nem dados de outra gráfica.
//
//   node scripts/teste-equipe.mjs
//
// Cria/apaga teste+eq-*@printos.test.

import { admin, novoUsuario, apagarUsuario, criarPlacar } from './_lib.mjs';

const P = criarPlacar('Sistema de equipe (dono × funcionário)');
let dono, func, outro;

const bloqueado = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0);

try {
  dono = await novoUsuario('eq-dono');
  func = await novoUsuario('eq-func');
  outro = await novoUsuario('eq-outro');

  const a = admin();
  // "convite": desativa a auto-gráfica do funcionário e o põe na gráfica do dono
  await a.from('grafica_membros').update({ ativo: false }).eq('membro_id', func.id);
  const { error: eConvite } = await a.from('grafica_membros').insert({
    grafica_id: dono.id, membro_id: func.id, papel: 'funcionario', nome: 'Maria Balcão',
  });
  P.check('dono adiciona funcionário', !eConvite, eConvite?.message);

  // re-loga o funcionário pra pegar o vínculo novo
  const { data: rel } = await func.cli.auth.refreshSession();
  if (rel?.session) { /* ok */ }

  // ---- funcionário enxerga a gráfica do dono ----
  const { data: mg } = await func.cli.rpc('minha_grafica');
  P.check('funcionário: minha_grafica() = gráfica do dono', mg === dono.id, `${mg} vs ${dono.id}`);

  // ---- PODE: serviços / materiais / clientes / pedidos ----
  const s = await func.cli.from('servicos').insert({ nome: 'Serv do func ' + Date.now(), preco: 5, unidade: 'un' }).select().single();
  P.check('funcionário cria serviço', !s.error, s.error?.message);
  P.check('serviço criado pertence à gráfica do dono', s.data?.user_id === dono.id);

  const m = await func.cli.from('materiais').insert({ nome: 'Mat do func ' + Date.now(), custo: 3 }).select().single();
  P.check('funcionário cria material', !m.error, m.error?.message);

  const c = await func.cli.from('clientes').insert({ nome: 'Cliente do balcão' }).select().single();
  P.check('funcionário cria cliente', !c.error, c.error?.message);

  const ped = await func.cli.from('pedidos').insert({ cliente_nome: 'Venda balcão', status: 'entregue', forma_pagamento: 'dinheiro' }).select().single();
  P.check('funcionário cria pedido (venda rápida)', !ped.error, ped.error?.message);
  P.check('pedido registra criado_por = funcionário', ped.data?.criado_por === func.id, `criado_por=${ped.data?.criado_por}`);
  if (ped.data) {
    const it = await func.cli.from('pedido_itens').insert({ pedido_id: ped.data.id, descricao: 'Cópia', quantidade: 10, preco_unitario: 0.5 });
    P.check('funcionário adiciona item ao pedido', !it.error, it.error?.message);
  }

  // ---- NÃO PODE: caixa ----
  const cxSel = await func.cli.from('caixa_sessoes').select('id');
  P.check('funcionário NÃO lê caixa_sessoes', bloqueado(cxSel), JSON.stringify(cxSel.data));
  const cxIns = await func.cli.from('caixa_sessoes').insert({ valor_abertura: 100 }).select();
  P.check('funcionário NÃO abre caixa', !!cxIns.error || (cxIns.data?.length ?? 0) === 0, 'inseriu');
  const cxMov = await func.cli.from('caixa_movimentos').select('id');
  P.check('funcionário NÃO lê caixa_movimentos', bloqueado(cxMov));

  // ---- NÃO PODE: orçamentos ----
  const orcSel = await func.cli.from('orcamentos').select('id');
  P.check('funcionário NÃO lê orçamentos', bloqueado(orcSel));
  const orcIns = await func.cli.from('orcamentos').insert({ cliente_nome: 'x' }).select();
  P.check('funcionário NÃO cria orçamento', !!orcIns.error || (orcIns.data?.length ?? 0) === 0);

  // ---- empresa: LÊ, não escreve ----
  await dono.cli.from('empresa').upsert({ user_id: dono.id, nome: 'Gráfica do Dono' });
  const empSel = await func.cli.from('empresa').select('nome').maybeSingle();
  P.check('funcionário LÊ dados da empresa (nome/logo pros docs)', !empSel.error && empSel.data?.nome === 'Gráfica do Dono', JSON.stringify(empSel));
  const empUpd = await func.cli.from('empresa').update({ nome: 'hackeado' }).eq('user_id', dono.id).select();
  P.check('funcionário NÃO edita a empresa', (empUpd.data?.length ?? 0) === 0);

  // ---- NÃO PODE: tokens de ingestão / whatsapp / aprovações ----
  const tokSel = await func.cli.from('ingest_tokens').select('id');
  P.check('funcionário NÃO lê ingest_tokens', bloqueado(tokSel));
  const waSel = await func.cli.from('whatsapp_numeros').select('id');
  P.check('funcionário NÃO lê whatsapp_numeros', bloqueado(waSel));
  const apvSel = await func.cli.from('pedido_aprovacoes').select('id');
  P.check('funcionário NÃO lê pedido_aprovacoes', bloqueado(apvSel));

  // ---- restrições finas: apagar cliente / alterar pedido só dono ----
  if (c.data) {
    const del = await func.cli.from('clientes').delete().eq('id', c.data.id).select();
    P.check('funcionário NÃO apaga cliente (só dono)', (del.data?.length ?? 0) === 0);
  }
  if (ped.data) {
    const upd = await func.cli.from('pedidos').update({ status: 'cancelado' }).eq('id', ped.data.id).select();
    P.check('funcionário NÃO altera pedido (só dono)', (upd.data?.length ?? 0) === 0);
  }

  // ---- o DONO enxerga tudo que o funcionário criou ----
  const donoVeServ = await dono.cli.from('servicos').select('id').eq('id', s.data?.id ?? '00000000-0000-0000-0000-000000000000');
  P.check('dono vê o serviço criado pelo funcionário', (donoVeServ.data?.length ?? 0) === 1);
  const donoVePed = await dono.cli.from('pedidos').select('id').eq('id', ped.data?.id ?? '00000000-0000-0000-0000-000000000000');
  P.check('dono vê o pedido do funcionário', (donoVePed.data?.length ?? 0) === 1);

  // ---- isolamento: funcionário da gráfica A não vê a gráfica de "outro" ----
  const { data: pOutro } = await outro.cli.from('pedidos').insert({ cliente_nome: 'Segredo do outro', status: 'entregue' }).select().single();
  const vazou = await func.cli.from('pedidos').select('id').eq('id', pOutro.id);
  P.check('funcionário NÃO vê pedido de outra gráfica', (vazou.data?.length ?? 0) === 0);

} catch (e) {
  console.error('\nERRO FATAL:', e.message);
  P.check('execução sem erro fatal', false, e.message);
} finally {
  await apagarUsuario(dono?.id);
  await apagarUsuario(func?.id);
  await apagarUsuario(outro?.id);
  console.log('\n(contas de teste apagadas)');
}

process.exit(P.fim() ? 0 : 1);
