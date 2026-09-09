import { createAdminClient } from '@/lib/supabase/admin';
import {
  assinaturaValida,
  enviarBotoes,
  enviarTexto,
  parsePedido,
} from '@/lib/whatsapp';

type Admin = ReturnType<typeof createAdminClient>;

// --- verificação do webhook (Meta) ---
export function GET(request: Request) {
  const u = new URL(request.url);
  const mode = u.searchParams.get('hub.mode');
  const token = u.searchParams.get('hub.verify_token');
  const challenge = u.searchParams.get('hub.challenge') ?? '';
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

// --- recebimento de mensagens ---
export async function POST(request: Request) {
  const raw = await request.text();
  if (!assinaturaValida(raw, request.headers.get('x-hub-signature-256'))) {
    return new Response('bad signature', { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  try {
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> })?.value ?? {};
        const mensagens = (value.messages as Record<string, unknown>[] | undefined) ?? [];
        for (const msg of mensagens) {
          await processarMensagem(createAdminClient(), msg);
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp] erro processando webhook', e);
  }

  // Sempre 200 — a Meta reentrega em erro/timeout.
  return new Response('ok', { status: 200 });
}

async function processarMensagem(admin: Admin, msg: Record<string, unknown>) {
  const waId = String(msg.id ?? '');
  const from = String(msg.from ?? '');
  const tipo = String(msg.type ?? '');
  if (!waId || !from) return;

  // dedupe
  const dedup = await admin.from('whatsapp_processados').insert({ wa_message_id: waId });
  if (dedup.error) return; // já processado (conflito de PK) ou erro — não repete

  const { data: numero } = await admin
    .from('whatsapp_numeros')
    .select('user_id')
    .eq('numero', from)
    .maybeSingle();

  if (!numero) {
    await enviarTexto(
      from,
      'Este número não está vinculado a nenhuma conta PrintOS. Peça ao dono para adicioná-lo em Configurações → WhatsApp.',
    );
    return;
  }
  const userId = numero.user_id as string;

  if (tipo === 'interactive') {
    const inter = msg.interactive as Record<string, unknown> | undefined;
    const br = inter?.button_reply as { id?: string } | undefined;
    if (br?.id) {
      const [acao, pendId] = br.id.split(':');
      await acaoBotao(admin, acao, pendId, from, userId);
    }
    return;
  }

  if (tipo === 'text') {
    const texto = String((msg.text as { body?: string } | undefined)?.body ?? '').trim();
    if (!texto) return;

    const { data: emEdicao } = await admin
      .from('whatsapp_pendentes')
      .select('*')
      .eq('de_numero', from)
      .eq('status', 'aguardando_edicao')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (emEdicao) {
      await aplicarEdicao(admin, emEdicao, texto, from);
      return;
    }

    const p = parsePedido(texto);
    if (!p.isPedido) {
      await enviarTexto(
        from,
        'Não parece um pedido. Se for, encaminhe a mensagem do cliente ou escreva algo como: "Cliente João · 100 cópias A4 · quanto fica".',
      );
      return;
    }

    const { data: pend } = await admin
      .from('whatsapp_pendentes')
      .insert({
        user_id: userId,
        de_numero: from,
        texto,
        cliente_sug: p.cliente,
        item_sug: p.item,
        qtd_sug: p.qtd,
      })
      .select('id')
      .single();
    if (!pend) return;

    await enviarCartao(from, pend.id, p.cliente, p.item, p.qtd);
  }
}

function enviarCartao(
  to: string,
  pendId: string,
  cliente: string | null,
  item: string | null,
  qtd: number | null,
) {
  const corpo = [
    '📋 *Novo pedido?*',
    `Cliente: ${cliente ?? '(não identificado)'}`,
    `Item: ${item ?? '—'}`,
    `Qtd: ${qtd ?? '—'}`,
  ].join('\n');
  return enviarBotoes(to, corpo, [
    { id: `ok:${pendId}`, title: '✅ Confirmar' },
    { id: `edit:${pendId}`, title: '✏️ Editar' },
    { id: `no:${pendId}`, title: '❌ Ignorar' },
  ]);
}

async function acaoBotao(
  admin: Admin,
  acao: string,
  pendId: string,
  from: string,
  userId: string,
) {
  const { data: pend } = await admin
    .from('whatsapp_pendentes')
    .select('*')
    .eq('id', pendId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!pend || pend.status === 'confirmado' || pend.status === 'ignorado') {
    await enviarTexto(from, 'Esse cartão já foi resolvido.');
    return;
  }

  if (acao === 'no') {
    await admin.from('whatsapp_pendentes').update({ status: 'ignorado' }).eq('id', pendId);
    await enviarTexto(from, 'Ok, ignorado. 👍');
    return;
  }

  if (acao === 'edit') {
    await admin
      .from('whatsapp_pendentes')
      .update({ status: 'aguardando_edicao' })
      .eq('id', pendId);
    await enviarTexto(
      from,
      'Manda assim, separado por " | ":\n*Cliente | Item | Quantidade*\nEx.: Padaria Pão Quente | Cartão de visita | 1000',
    );
    return;
  }

  if (acao === 'ok') {
    await criarPedido(admin, pend, from, userId);
  }
}

async function aplicarEdicao(
  admin: Admin,
  pend: Record<string, unknown>,
  texto: string,
  from: string,
) {
  const partes = texto.split('|').map((s) => s.trim());
  const cliente = partes[0] || (pend.cliente_sug as string | null);
  const item = partes[1] || (pend.item_sug as string | null);
  const qtdRaw = partes[2]?.replace(',', '.').replace(/[^\d.]/g, '');
  const qtd = qtdRaw ? Number(qtdRaw) : (pend.qtd_sug as number | null);

  await admin
    .from('whatsapp_pendentes')
    .update({
      cliente_sug: cliente || null,
      item_sug: item || null,
      qtd_sug: qtd && qtd > 0 ? qtd : null,
      status: 'pendente',
    })
    .eq('id', pend.id as string);

  await enviarCartao(
    from,
    pend.id as string,
    cliente || null,
    item || null,
    qtd && qtd > 0 ? qtd : null,
  );
}

async function criarPedido(
  admin: Admin,
  pend: Record<string, unknown>,
  from: string,
  userId: string,
) {
  const { data: pedido, error } = await admin
    .from('pedidos')
    .insert({
      user_id: userId,
      cliente_nome: (pend.cliente_sug as string | null) || 'Cliente WhatsApp',
      status: 'aguardando_arte',
      origem: 'whatsapp',
      origem_texto: pend.texto as string,
    })
    .select('id, numero')
    .single();

  if (error || !pedido) {
    await enviarTexto(from, 'Ops, não consegui criar o pedido agora. Tente pelo site.');
    return;
  }

  if (pend.item_sug) {
    await admin.from('pedido_itens').insert({
      pedido_id: pedido.id,
      user_id: userId,
      descricao: pend.item_sug as string,
      quantidade: (pend.qtd_sug as number | null) || 1,
      preco_unitario: 0,
      ordem: 0,
    });
  }

  await admin
    .from('whatsapp_pendentes')
    .update({ status: 'confirmado', pedido_id: pedido.id })
    .eq('id', pend.id as string);

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const link = base ? `\n${base}/pedidos/${pedido.id}` : '';
  await enviarTexto(
    from,
    `✅ Pedido *#${pedido.numero}* criado (aguardando arte).${link}\nAjuste itens e preço pelo site.`,
  );
}
