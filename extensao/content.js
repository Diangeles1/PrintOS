// Roda em web.whatsapp.com. NÃO lê nada em segundo plano — só quando
// o usuário clica no botão "Pedido". Um MutationObserver mantém o botão
// presente quando o WhatsApp re-renderiza o cabeçalho.

const BTN_ID = 'printos-btn-pedido';

function acharHeader() {
  return document.querySelector('#main header') || document.querySelector('header[data-testid]');
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

async function pegarImagem() {
  // pega a imagem mais recente do thread (thumbnail blob:), se der
  const imgs = Array.from(document.querySelectorAll('#main img[src^="blob:"]'));
  const alvo = imgs[imgs.length - 1];
  if (!alvo) return null;
  try {
    const blob = await (await fetch(alvo.src)).blob();
    if (!blob || blob.size === 0 || blob.size > 10 * 1024 * 1024) return null;
    const mime = blob.type || 'image/jpeg';
    if (!/^image\//.test(mime)) return null;
    const base64 = await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] || '');
      fr.readAsDataURL(blob);
    });
    return { nome: 'arte.jpg', mime, base64 };
  } catch {
    return null;
  }
}

function heuristica(texto) {
  const t = texto.replace(/\s+/g, ' ').trim();
  const q = t.match(/(\d{1,6})\s*(un|unid|folhas?|c[óo]pias?|cart[õo]es?|banners?|panfletos?|adesivos?|m2|m²)?/i);
  return { qtd: q ? Number(q[1]) : null };
}

async function abrirPainel() {
  const contato = nomeDoContato();
  const texto = coletarMensagens();
  const arquivo = await pegarImagem();
  const { qtd } = heuristica(texto);
  chrome.runtime.sendMessage({
    type: 'abrir',
    dados: { contato, texto, arquivo, qtdSug: qtd },
  });
}

function montarBotao() {
  const header = acharHeader();
  if (!header || document.getElementById(BTN_ID)) return;
  const b = document.createElement('button');
  b.id = BTN_ID;
  b.type = 'button';
  b.textContent = '＋ Pedido';
  b.title = 'Registrar este pedido no PrintOS';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirPainel();
  });
  header.appendChild(b);
}

const obs = new MutationObserver(() => montarBotao());
obs.observe(document.body, { childList: true, subtree: true });
montarBotao();
