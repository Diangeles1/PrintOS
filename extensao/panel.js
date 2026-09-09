const $ = (id) => document.getElementById(id);
let arquivo = null;

function linhaItem(desc = '', qtd = 1) {
  const div = document.createElement('div');
  div.className = 'item';
  div.innerHTML =
    '<input class="d" placeholder="Descrição do item" />' +
    '<input class="q" type="number" min="0" step="1" />' +
    '<button type="button" title="remover">✕</button>';
  div.querySelector('.d').value = desc;
  div.querySelector('.q').value = qtd;
  div.querySelector('button').addEventListener('click', () => div.remove());
  return div;
}

function coletarItens() {
  return Array.from(document.querySelectorAll('#itens .item'))
    .map((d) => ({
      descricao: d.querySelector('.d').value.trim(),
      quantidade: Number(d.querySelector('.q').value) || 1,
    }))
    .filter((i) => i.descricao);
}

chrome.runtime.sendMessage({ type: 'pegarDados' }, (resp) => {
  const d = (resp && resp.dados) || {};
  $('cliente').value = d.contato || '';
  $('conversa').textContent = d.texto || '(sem texto)';

  // primeira linha do cliente como item inicial
  const primeira = (d.texto || '')
    .split('\n')
    .map((l) => l.replace(/^\[nós\]\s*/, '').trim())
    .find(Boolean);
  $('itens').appendChild(linhaItem(primeira ? primeira.slice(0, 120) : '', d.qtdSug || 1));

  if (d.arquivo && d.arquivo.base64) {
    arquivo = d.arquivo;
    const box = $('arte');
    box.hidden = false;
    box.innerHTML =
      '<img src="data:' +
      d.arquivo.mime +
      ';base64,' +
      d.arquivo.base64 +
      '" alt="arte" /><span>Arte do cliente será anexada</span>';
  }
});

$('add').addEventListener('click', () => $('itens').appendChild(linhaItem()));
$('cancelar').addEventListener('click', () => window.close());

$('criar').addEventListener('click', async () => {
  const btn = $('criar');
  const msg = $('msg');
  msg.className = 'msg';
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  const pedido = {
    cliente: $('cliente').value.trim() || undefined,
    itens: coletarItens(),
    prazo: $('prazo').value || undefined,
    observacoes: $('obs').value.trim() || undefined,
    texto: $('conversa').textContent.slice(0, 5000),
    arquivo: arquivo || undefined,
  };

  chrome.runtime.sendMessage({ type: 'enviar', pedido }, (r) => {
    btn.disabled = false;
    btn.textContent = 'Criar pedido';
    if (!r || !r.ok) {
      msg.className = 'msg err';
      msg.textContent = 'Erro: ' + ((r && r.erro) || 'sem resposta');
      return;
    }
    msg.className = 'msg ok';
    msg.textContent = '✅ Pedido #' + r.numero + ' criado' + (r.arquivo ? ' (com arte)' : '') + '.';
    if (r.url) {
      const a = document.createElement('a');
      a.href = r.url;
      a.target = '_blank';
      a.textContent = ' abrir';
      a.style.marginLeft = '6px';
      msg.appendChild(a);
    }
    setTimeout(() => window.close(), 2500);
  });
});
