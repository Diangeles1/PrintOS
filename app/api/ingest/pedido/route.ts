import crypto from 'crypto';

import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const MIMES_OK = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_ARQUIVO = 10 * 1024 * 1024; // 10 MB por arquivo
const MAX_ARQUIVOS = 6; // no máximo 6 imagens por pedido
const MAX_BODY = 40 * 1024 * 1024;
const LIMITE_HORA = 200; // por conta (todos os canais somados)
const LIMITE_TOKEN = 120; // por token, por hora
const FORMAS = new Set(['dinheiro', 'pix', 'debito', 'credito', 'outro']);

function cors(origin: string | null) {
  const permitido =
    origin && /^(chrome-extension|moz-extension):\/\//.test(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    Vary: 'Origin',
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) });
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
  });
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function numero(v: unknown, min: number, def: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length < 20 || token.length > 200) {
    return json({ erro: 'token ausente' }, 401, origin);
  }

  const tamanho = Number(request.headers.get('content-length') ?? 0);
  if (tamanho > MAX_BODY) return json({ erro: 'payload grande demais' }, 413, origin);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ erro: 'json inválido' }, 400, origin);
  }

  const admin = createAdminClient();
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: tok } = await admin
    .from('ingest_tokens')
    .select('id, user_id, expira_em, janela_inicio, janela_contagem')
    .eq('token_hash', hash)
    .maybeSingle();
  if (!tok) return json({ erro: 'token inválido' }, 401, origin);
  if (tok.expira_em && new Date(tok.expira_em as string) < new Date()) {
    return json({ erro: 'token expirado — gere um novo em Configurações' }, 401, origin);
  }

  const userId = tok.user_id as string;
  const agora = Date.now();

  // limite POR TOKEN: janela deslizante de 1h, LIMITE_TOKEN pedidos.
  const janelaAberta = agora - new Date(tok.janela_inicio as string).getTime() < 3600_000;
  const contagem = janelaAberta ? (tok.janela_contagem as number) : 0;
  if (contagem >= LIMITE_TOKEN) {
    return json({ erro: 'limite por hora do token atingido' }, 429, origin);
  }

  // backstop POR CONTA (soma de todos os tokens/canais): LIMITE_HORA.
  const desde = new Date(agora - 3600_000).toISOString();
  const { count } = await admin
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('origem', ['whatsapp', 'whatsapp_ext'])
    .gte('created_at', desde);
  if ((count ?? 0) >= LIMITE_HORA) {
    return json({ erro: 'limite por hora da conta atingido' }, 429, origin);
  }

  const clienteNome = texto(body.cliente, 200) ?? 'Pedido WhatsApp';
  const mensagem = texto(body.texto, 5000);
  const observacoes = texto(body.observacoes, 2000);
  const prazoRaw = texto(body.prazo, 10);
  const prazo = prazoRaw && /^\d{4}-\d{2}-\d{2}$/.test(prazoRaw) ? prazoRaw : null;

  const formaRaw = texto(body.forma_pagamento, 20);
  const formaPagamento = formaRaw && FORMAS.has(formaRaw) ? formaRaw : null;

  // valor total informado no painel — vira preço do primeiro item quando ele não tem preço
  const valorTotal = numero(body.valor, 0, 0);

  const itensIn = Array.isArray(body.itens) ? body.itens.slice(0, 50) : [];
  const itens = itensIn
    .map((raw, idx) => {
      const r = raw as Record<string, unknown>;
      const descricao = texto(r.descricao, 300) ?? 'Item';
      return {
        descricao,
        quantidade: numero(r.quantidade, 0.001, 1),
        preco_unitario: numero(r.preco_unitario, 0, 0),
        ordem: idx,
      };
    })
    .filter((i) => i.descricao);

  if (valorTotal > 0) {
    if (itens.length && itens[0].preco_unitario === 0) {
      itens[0].preco_unitario = valorTotal;
    } else if (!itens.length) {
      itens.push({ descricao: 'Pedido', quantidade: 1, preco_unitario: valorTotal, ordem: 0 });
    }
  }

  const { data: pedido, error: e1 } = await admin
    .from('pedidos')
    .insert({
      user_id: userId,
      cliente_nome: clienteNome,
      status: 'aguardando_arte',
      origem: 'whatsapp_ext',
      origem_texto: mensagem,
      observacoes,
      prazo,
      forma_pagamento: formaPagamento,
    })
    .select('id, numero')
    .single();
  if (e1 || !pedido) {
    return json({ erro: 'falha ao criar pedido' }, 500, origin);
  }

  if (itens.length) {
    await admin
      .from('pedido_itens')
      .insert(itens.map((i) => ({ ...i, pedido_id: pedido.id, user_id: userId })));
  }

  // arte opcional — aceita `arquivos: [...]` (novo) ou `arquivo: {...}` (antigo)
  const entrada = Array.isArray(body.arquivos)
    ? body.arquivos
    : body.arquivo
      ? [body.arquivo]
      : [];
  const candidatos = entrada.slice(0, MAX_ARQUIVOS) as Record<string, unknown>[];

  let arquivosSalvos = 0;
  for (const arq of candidatos) {
    if (!arq || typeof arq.base64 !== 'string' || typeof arq.mime !== 'string') continue;
    if (!MIMES_OK.has(arq.mime)) continue;
    const buf = Buffer.from(arq.base64, 'base64');
    if (buf.byteLength === 0 || buf.byteLength > MAX_ARQUIVO) continue;
    const nomeSeguro = (texto(arq.nome, 120) ?? 'arte')
      .replace(/[^\w.\- ]+/g, '_')
      .slice(0, 120);
    const path = `${userId}/${pedido.id}/${Date.now()}-${arquivosSalvos}-${nomeSeguro}`;
    const up = await admin.storage
      .from('pedido-arquivos')
      .upload(path, buf, { contentType: arq.mime, upsert: false });
    if (up.error) continue;
    await admin.from('pedido_arquivos').insert({
      pedido_id: pedido.id,
      user_id: userId,
      path,
      nome: nomeSeguro,
      mime: arq.mime,
      tamanho: buf.byteLength,
    });
    arquivosSalvos += 1;
  }

  await admin
    .from('ingest_tokens')
    .update({
      last_used_at: new Date().toISOString(),
      janela_inicio: janelaAberta ? (tok.janela_inicio as string) : new Date(agora).toISOString(),
      janela_contagem: contagem + 1,
    })
    .eq('id', tok.id);

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return json(
    {
      ok: true,
      id: pedido.id,
      numero: pedido.numero,
      arquivos: arquivosSalvos,
      arquivo: arquivosSalvos > 0,
      url: base ? `${base}/pedidos/${pedido.id}` : undefined,
    },
    201,
    origin,
  );
}
