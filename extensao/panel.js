const $ = (id) => document.getElementById(id);

let imagens = []; // candidatas vindas da conversa
const escolhidas = new Set(); // índices selecionados

function pintarInfo() {
  const info = $('arte-info');
  if (!imagens.length) return;
  info.textContent = escolhidas.size
    ? `${escolhidas.size} de ${imagens.length} selecionada${escolhidas.size > 1 ? 's' : ''}. Só as marcadas vão pro pedido.`
    : `${imagens.length} ${imagens.length > 1 ? 'imagens' : 'imagem'} na conversa. Toque para escolher a arte.`;
}

function montarImagens() {
  const grid = $('imgs');
  const info = $('arte-info');
  grid.innerHTML = '';

  if (!imagens.length) {
    info.textContent = '';
    const vazio = document.createElement('div');
    vazio.className = 'arte-vazio';
    vazio.textContent = 'Nenhuma imagem encontrada na conversa. Você anexa a arte depois, pelo site.';
    grid.appendChild(vazio);
    return;
  }

  imagens.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'imgpick';
    b.innerHTML =
      '<img src="data:' + img.mime + ';base64,' + img.base64 + '" alt="" /><span class="tick">✓</span>';
    b.addEventListener('click', () => {
      if (escolhidas.has(i)) escolhidas.delete(i);
      else escolhidas.add(i);
      b.classList.toggle('on', escolhidas.has(i));
      pintarInfo();
    });
    grid.appendChild(b);
  });
  pintarInfo();
}

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

  imagens = Array.isArray(d.imagens) ? d.imagens : [];
  montarImagens();
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

  const valor = Number($('valor').value) || 0;
  const arquivos = [...escolhidas].sort((a, b) => a - b).map((i) => imagens[i]);

  const pedido = {
    cliente: $('cliente').value.trim() || undefined,
    itens: coletarItens(),
    valor: valor > 0 ? valor : undefined,
    prazo: $('prazo').value || undefined,
    forma_pagamento: $('forma').value || undefined,
    observacoes: $('obs').value.trim() || undefined,
    texto: $('conversa').textContent.slice(0, 5000),
    arquivos: arquivos.length ? arquivos : undefined,
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
    const nArq = r.arquivos ?? (r.arquivo ? 1 : 0);
    msg.textContent =
      '✅ Pedido #' + r.numero + ' criado' + (nArq ? ` (${nArq} ${nArq > 1 ? 'imagens' : 'imagem'})` : '') + '.';
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
