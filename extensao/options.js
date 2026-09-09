const $ = (id) => document.getElementById(id);

chrome.storage.local.get(['printosUrl', 'token'], (v) => {
  $('url').value = v.printosUrl || '';
  $('token').value = v.token || '';
});

$('salvar').addEventListener('click', async () => {
  const msg = $('msg');
  msg.className = 'msg';
  const url = $('url').value.trim().replace(/\/$/, '');
  const token = $('token').value.trim();

  if (!/^https?:\/\/.+/.test(url)) {
    msg.className = 'msg err';
    msg.textContent = 'URL inválida (precisa começar com http:// ou https://).';
    return;
  }
  if (!/^pit_[a-f0-9]{20,}$/.test(token)) {
    msg.className = 'msg err';
    msg.textContent = 'Token inválido (começa com pit_).';
    return;
  }

  // pede permissão só para essa origem
  const origem = new URL(url).origin + '/*';
  const concedido = await chrome.permissions.request({ origins: [origem] }).catch(() => false);
  if (!concedido) {
    msg.className = 'msg err';
    msg.textContent = 'Permissão para acessar ' + origem + ' negada.';
    return;
  }

  chrome.storage.local.set({ printosUrl: url, token }, () => {
    msg.className = 'msg ok';
    msg.textContent = 'Salvo. Abra uma conversa no WhatsApp Web e use o botão “＋ Pedido”.';
  });
});
