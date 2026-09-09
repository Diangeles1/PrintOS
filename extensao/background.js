// Service worker: guarda o payload entre content script e painel,
// e é o ÚNICO lugar que toca no token (o painel e o WhatsApp nunca o veem).

let pendente = null;

async function cfg() {
  const { printosUrl, token } = await chrome.storage.local.get(['printosUrl', 'token']);
  return { printosUrl: (printosUrl || '').replace(/\/$/, ''), token: token || '' };
}

async function enviarPedido(pedido) {
  const { printosUrl, token } = await cfg();
  if (!printosUrl || !token) {
    return { ok: false, erro: 'Configure a URL do PrintOS e o token nas opções da extensão.' };
  }
  try {
    const r = await fetch(printosUrl + '/api/ingest/pedido', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(pedido),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, erro: data.erro || ('HTTP ' + r.status) };
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'abrir') {
    pendente = msg.dados || null;
    chrome.windows.create({
      url: chrome.runtime.getURL('panel.html'),
      type: 'popup',
      width: 440,
      height: 680,
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'pegarDados') {
    sendResponse({ dados: pendente });
    return true;
  }
  if (msg.type === 'enviar') {
    enviarPedido(msg.pedido).then(sendResponse);
    return true; // resposta assíncrona
  }
});
