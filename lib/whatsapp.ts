import crypto from 'crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

function cfg() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  return { token, phoneId, ok: Boolean(token && phoneId) };
}

/** Confere a assinatura X-Hub-Signature-256 (app secret da Meta). */
export function assinaturaValida(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sem secret configurado, não bloqueia (dev)
  if (!header?.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const recebido = header.slice('sha256='.length);
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function enviar(payload: Record<string, unknown>) {
  const { token, phoneId, ok } = cfg();
  if (!ok) {
    console.warn('[whatsapp] WHATSAPP_TOKEN/PHONE_ID ausentes — mensagem não enviada.');
    return;
  }
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  if (!r.ok) {
    console.error('[whatsapp] envio falhou', r.status, await r.text().catch(() => ''));
  }
}

export function enviarTexto(to: string, body: string) {
  return enviar({ to, type: 'text', text: { body, preview_url: true } });
}

export function enviarBotoes(
  to: string,
  corpo: string,
  botoes: { id: string; title: string }[],
) {
  return enviar({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: corpo.slice(0, 1024) },
      action: {
        buttons: botoes.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

// ---- heurística: a mensagem parece um pedido? extrai o que der ----
const GATILHOS =
  /\b(quero|queria|preciso|gostaria|me v[êe]|fazer|faz|fazem|voc[êe]s fazem|or[çc]amento|or[çc]a|quanto (fica|custa|sai|d[áa]|seria)|valor|pre[çc]o|imprimir|impress[ãa]o|c[óo]pias?|xerox|banner|faixa|cart[ãa]o|adesivo|lona|panfleto|folder|encaderna|plastifica)\b/i;

const UNIDADES =
  /(un|unid|unidades?|folhas?|c[óo]pias?|p[áa]ginas?|banners?|faixas?|cart[õo]es?|adesivos?|panfletos?|folders?|m²|m2|metros?)/i;

export function parsePedido(texto: string) {
  const t = texto.replace(/\s+/g, ' ').trim();

  const qtdMatch =
    t.match(new RegExp(`(\\d[\\d.]*)\\s*${UNIDADES.source}`, 'i')) ||
    t.match(/\b(\d{1,6})\b/);
  const qtd = qtdMatch ? Number(qtdMatch[1].replace(/\./g, '')) : null;

  const cliMatch = t.match(
    /\b(?:cliente|para o?a?|pra o?a?|em nome de|sou o?a?|aqui [ée] o?a?|meu nome [ée])[:\s]+([A-Za-zÀ-ú][A-Za-zÀ-ú' ]{2,40})/i,
  );
  const cliente = cliMatch ? cliMatch[1].trim().replace(/\s+/g, ' ') : null;

  const primeiraLinha = texto.split('\n').map((l) => l.trim()).find(Boolean) ?? t;

  return {
    isPedido: GATILHOS.test(t),
    qtd: qtd && qtd > 0 && qtd < 1_000_000 ? qtd : null,
    cliente,
    item: primeiraLinha.slice(0, 140),
  };
}
