// TESTE CRÍTICO: uma gráfica NUNCA pode ver/mexer nos dados de outra.
// Cria 2 contas reais, planta dados na conta A e tenta acessá-los pela conta B
// (RLS ativa, JWT de usuário). Também testa se B consegue inserir linha
// "no nome" de A (deve ser barrado pelo WITH CHECK).
//
//   node scripts/teste-isolamento.mjs
//
// Cria/apaga usuários teste+iso-*@printos.test no seu projeto Supabase.

import { admin, novoUsuario, apagarUsuario, tokenIngest, tokenAprovacao, criarPlacar } from './_lib.mjs';

const P = criarPlacar('Isolamento entre contas (multi-tenant)');
let A;
let B;

try {
  A = await novoUsuario('iso-a');
  B = await novoUsuario('iso-b');
  console.log(`  conta A = ${A.id}\n  conta B = ${B.id}\n`);

  // --- planta um pedido em A (base para linhas dependentes) ---
  const { data: pedA, error: ePed } = await A.cli
    .from('pedidos')
    .insert({ cliente_nome: 'Cliente da conta A', status: 'aguardando_arte' })
    .select('id')
    .single();
  if (ePed) throw new Error('não consegui criar pedido base em A: ' + ePed.message);
  const pedidoA = pedA.id;

  const tk = tokenIngest();
  const tkApv = tokenAprovacao();

  // Cada spec: cria uma linha em A e diz como identificá-la.
  const specs = [
    { tabela: 'clientes', row: { nome: 'Cliente Secreto A' } },
    { tabela: 'materiais', row: { nome: 'Material Secreto A' } },
    { tabela: 'servicos', row: { nome: 'Servico Secreto A ' + Date.now() } },
    { tabela: 'empresa', row: { nome: 'Empresa Secreta A' }, chave: 'user_id', chaveVal: () => A.id, upsert: true },
    { tabela: 'orcamentos', row: { cliente_nome: 'Orc Secreto A' } },
    { tabela: 'pedidos', row: { cliente_nome: 'Ped Secreto A', status: 'aguardando_arte' } },
    { tabela: 'caixa_sessoes', row: { valor_abertura: 123.45 } },
    { tabela: 'whatsapp_numeros', row: { numero: '55' + Date.now().toString().slice(-11), apelido: 'Balcão A' } },
    { tabela: 'ingest_tokens', row: { token_hash: tk.hash, label: 'PC do balcão A' } },
    { tabela: 'pedido_aprovacoes', row: { pedido_id: pedidoA, token: tkApv } },
    { tabela: 'pedido_arquivos', row: { pedido_id: pedidoA, user_id: null, path: `x/${pedidoA}/secreto.png`, nome: 'secreto.png' } },
  ];

  for (const s of specs) {
    if (s.tabela === 'pedido_arquivos') s.row.user_id = A.id; // exigido pela tabela

    // 1) A insere (RLS on) — se a própria inserção falhar, já é um problema
    let ins = await A.cli.from(s.tabela)[s.upsert ? 'upsert' : 'insert'](s.row).select().single();
    P.check(`A consegue inserir em ${s.tabela}`, !ins.error, ins.error?.message);
    if (ins.error) continue;

    const linha = ins.data;
    const filtro = s.chave
      ? [s.chave, s.chaveVal()]
      : ['id', linha.id];

    // 2) B tenta LER a linha de A
    const sel = await B.cli.from(s.tabela).select('*').eq(filtro[0], filtro[1]);
    P.check(`B NÃO lê ${s.tabela} de A`, !sel.error && (sel.data?.length ?? 0) === 0,
      sel.error ? sel.error.message : `retornou ${sel.data?.length} linha(s)`);

    // 3) B tenta ATUALIZAR a linha de A
    const upd = await B.cli.from(s.tabela).update({ }).eq(filtro[0], filtro[1]).select();
    P.check(`B NÃO altera ${s.tabela} de A`, (upd.data?.length ?? 0) === 0,
      `afetou ${upd.data?.length ?? 0} linha(s)`);

    // 4) B tenta APAGAR a linha de A
    const del = await B.cli.from(s.tabela).delete().eq(filtro[0], filtro[1]).select();
    P.check(`B NÃO apaga ${s.tabela} de A`, (del.data?.length ?? 0) === 0,
      `apagou ${del.data?.length ?? 0} linha(s)`);

    // 5) confirma pelo admin que a linha de A continua lá
    const conf = await admin().from(s.tabela).select('*').eq(filtro[0], filtro[1]);
    P.check(`linha de A em ${s.tabela} sobreviveu`, (conf.data?.length ?? 0) >= 1);

    // 6) B tenta INSERIR uma linha marcada como sendo de A (roubo de dono)
    if (!s.chave && 'user_id' in (linha ?? {})) {
      const forjada = { ...s.row, user_id: A.id };
      const roubo = await B.cli.from(s.tabela).insert(forjada).select();
      P.check(`B NÃO insere ${s.tabela} no nome de A`, !!roubo.error || (roubo.data?.length ?? 0) === 0,
        roubo.error ? '' : 'insert passou');
      // limpa se por acaso entrou
      if (!roubo.error && roubo.data?.[0]?.id) {
        await admin().from(s.tabela).delete().eq('id', roubo.data[0].id);
      }
    }
  }

  // --- endpoint de ingestão: token de A não pode criar pedido em B (nem vice-versa) ---
  // (só confere que o token resolve para A; o endpoint em si é testado no fluxo)
  const { data: tokRow } = await admin()
    .from('ingest_tokens').select('user_id').eq('token_hash', tk.hash).maybeSingle();
  P.check('token de ingestão de A resolve para a conta A', tokRow?.user_id === A.id);

} catch (e) {
  console.error('\nERRO FATAL:', e.message);
  P.check('execução sem erro fatal', false, e.message);
} finally {
  await apagarUsuario(A?.id);
  await apagarUsuario(B?.id);
  console.log('\n(usuários de teste apagados)');
}

process.exit(P.fim() ? 0 : 1);
