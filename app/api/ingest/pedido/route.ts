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
const MAX_ARQUIVO = 10 * 1024 * 1024; // 10 MB
const MAX_BODY = 20 * 1024 * 1024;
const LIMITE_HORA = 200;

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
    .select('id, user_id')
    .eq('token_hash', hash)
    .maybeSingle();
  if (!tok) return json({ erro: 'token inválido' }, 401, origin);

  const userId = tok.user_id as string;

  // rate limit simples
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('origem', ['whatsapp', 'whatsapp_ext'])
    .gte('created_at', desde);
  if ((count ?? 0) >= LIMITE_HORA) {
    return json({ erro: 'limite por hora atingido' }, 429, origin);
  }

  const clienteNome = texto(body.cliente, 200) ?? 'Pedido WhatsApp';
  const mensagem = texto(body.texto, 5000);
  const observacoes = texto(body.observacoes, 2000);
  const prazoRaw = texto(body.prazo, 10);
  const prazo = prazoRaw && /^\d{4}-\d{2}-\d{2}$/.test(prazoRaw) ? prazoRaw : null;

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

  // arquivo (arte) opcional
  const arq = body.arquivo as Record<string, unknown> | undefined;
  let arquivoSalvo = false;
  if (arq && typeof arq.base64 === 'string' && typeof arq.mime === 'string') {
    if (MIMES_OK.has(arq.mime)) {
      const buf = Buffer.from(arq.base64, 'base64');
      if (buf.byteLength > 0 && buf.byteLength <= MAX_ARQUIVO) {
        const nomeSeguro = (texto(arq.nome, 120) ?? 'arte')
          .replace(/[^\w.\- ]+/g, '_')
          .slice(0, 120);
        const path = `${userId}/${pedido.id}/${Date.now()}-${nomeSeguro}`;
        const up = await admin.storage
          .from('pedido-arquivos')
          .upload(path, buf, { contentType: arq.mime, upsert: false });
        if (!up.error) {
          await admin.from('pedido_arquivos').insert({
            pedido_id: pedido.id,
            user_id: userId,
            path,
            nome: nomeSeguro,
            mime: arq.mime,
            tamanho: buf.byteLength,
          });
          arquivoSalvo = true;
        }
      }
    }
  }

  await admin.from('ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id);

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return json(
    {
      ok: true,
      id: pedido.id,
      numero: pedido.numero,
      arquivo: arquivoSalvo,
      url: base ? `${base}/pedidos/${pedido.id}` : undefined,
    },
    201,
    origin,
  );
}
