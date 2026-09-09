// Roda em web.whatsapp.com. NÃO lê nada em segundo plano: só quando
// o usuário clica no botão "Pedido".
//
// O botão é um elemento flutuante próprio, dentro de um Shadow DOM
// isolado: não é injetado no HTML do WhatsApp, não altera o layout dele
// e o CSS/JS do WhatsApp não alcança o botão (nem o contrário). Se a
// Meta mudar a tela, o botão continua no lugar; no máximo a leitura do
// nome do contato/arte falha e você digita na mão.

const HOST_ID = 'printos-host';

// true enquanto este content script ainda pertence a uma extensão viva.
// Depois de recarregar/atualizar a extensão, o script antigo que sobrou
// na página perde o contexto; aí paramos tudo em vez de dar erro.
function extensaoViva() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function acharHeader() {
  return document.querySelector('#main header') || document.querySelector('header[data-testid]');
}

function temConversaAberta() {
  return !!document.querySelector('#main');
}

function nomeDoContato() {
  const h = acharHeader();
  if (!h) return '';
  const cands = [
    h.querySelector('span[dir="auto"][title]'),
    h.querySelector('span[dir="auto"]'),
    h.querySelector('[role="button"] span'),
  ];
  for (const c of cands) {
    const t = (c?.getAttribute?.('title') || c?.textContent || '').trim();
    if (t) return t;
  }
  return '';
}

function coletarMensagens(limite = 18) {
  const linhas = [];
  const nodes = document.querySelectorAll('#main div.message-in, #main div.message-out');
  const arr = Array.from(nodes).slice(-limite);
  for (const n of arr) {
    const txt = Array.from(n.querySelectorAll('span.selectable-text'))
      .map((s) => s.innerText)
      .join(' ')
      .trim();
    if (!txt) continue;
    const dele = n.classList.contains('message-in');
    linhas.push((dele ? '' : '[nós] ') + txt);
  }
  return linhas.join('\n');
}

const IMG_MAX = 8; // no máximo 8 candidatas
const IMG_BYTES = 8 * 1024 * 1024; // 8 MB por imagem
const IMG_MIN_LADO = 90; // ignora figurinha / emoji / miniatura de resposta

function blobParaBase64(blob) {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => res('');
    fr.readAsDataURL(blob);
  });
}

// Junta as imagens grandes da conversa (mais recente primeiro) pra você
// ESCOLHER no painel qual é a arte. Nada é anexado automaticamente.
async function coletarImagens() {
  const vistos = new Set();
  const alvos = Array.from(document.querySelectorAll('#main img'))
    .filter((im) => /^(blob:|data:image\/)/.test(im.currentSrc || im.src || ''))
    .reverse();

  const out = [];
  for (const im of alvos) {
    const src = im.currentSrc || im.src;
    if (!src || vistos.has(src)) continue;
    vistos.add(src);

    const w = im.naturalWidth || im.width || 0;
    const h = im.naturalHeight || im.height || 0;
    if (w < IMG_MIN_LADO || h < IMG_MIN_LADO) continue;

    try {
      const blob = await (await fetch(src)).blob();
      if (!blob || blob.size === 0 || blob.size > IMG_BYTES) continue;
      const mime = blob.type || 'image/jpeg';
      if (!/^image\//.test(mime)) continue;
      const base64 = await blobParaBase64(blob);
      if (!base64) continue;
      const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      out.push({ nome: `arte-${out.length + 1}.${ext}`, mime, base64, w, h });
      if (out.length >= IMG_MAX) break;
    } catch {
      /* ignora essa imagem */
    }
  }
  return out;
}

async function abrirPainel() {
  if (!extensaoViva()) throw new Error('recarregue-a-pagina');
  // só coleta o básico pra pré-preencher; quem registra é a pessoa, no painel
  const contato = nomeDoContato();
  const texto = coletarMensagens();
  const imagens = await coletarImagens();
  try {
    chrome.runtime.sendMessage({ type: 'abrir', dados: { contato, texto, imagens } });
  } catch {
    throw new Error('recarregue-a-pagina');
  }
}

function montarBotao() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .fab {
        position: fixed;
        right: 22px;
        bottom: 120px;
        z-index: 3000;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 11px 16px 11px 13px;
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #175bff, #2f7bff);
        color: #fff;
        font: 600 13.5px/1 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 12px 28px -8px rgba(23, 91, 255, 0.55), 0 2px 6px rgba(0, 0, 0, 0.18);
        transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
      }
      .fab:hover { transform: translateY(-1px); box-shadow: 0 16px 34px -8px rgba(23, 91, 255, 0.62); }
      .fab:active { transform: translateY(0); }
      .fab[hidden] { display: none; }
      .plus { font-size: 16px; font-weight: 800; }
    </style>
    <button class="fab" type="button" title="Registrar este pedido no PrintOS">
      <span class="plus">+</span><span class="txt">Pedido</span>
    </button>
  `;

  const btn = root.querySelector('.fab');
  const txt = root.querySelector('.txt');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    txt.textContent = 'Lendo…';
    try {
      await abrirPainel();
      txt.textContent = 'Pedido';
    } catch (err) {
      txt.textContent =
        String(err && err.message) === 'recarregue-a-pagina' ? 'Recarregue a página (F5)' : 'Erro, tente de novo';
      setTimeout(() => {
        txt.textContent = 'Pedido';
      }, 4000);
    } finally {
      delete btn.dataset.busy;
    }
  });

  (document.body || document.documentElement).appendChild(host);

  // aparece só quando há uma conversa aberta. Checagem leve, sem
  // observar o DOM inteiro do WhatsApp.
  const timer = setInterval(() => {
    if (!extensaoViva()) {
      // extensão foi recarregada/atualizada: some com o botão órfão.
      clearInterval(timer);
      host.remove();
      return;
    }
    btn.hidden = !temConversaAberta();
  }, 1000);
  btn.hidden = !temConversaAberta();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', montarBotao);
} else {
  montarBotao();
}
