# Extensão PrintOS — Pedido do WhatsApp Web

Um botão **“＋ Pedido”** dentro de cada conversa do WhatsApp Web. Um clique
captura o nome do contato, as últimas mensagens e a arte anexada, abre um
painel de revisão e cria o pedido no PrintOS (status *aguardando arte*).

Não é bot: **só lê a tela quando você clica**, não envia mensagem, não
roda nada em segundo plano.

## Segurança

- Usa um **token de ingestão** com escopo mínimo: só `POST /api/ingest/pedido`
  (criar pedido + anexar arte). Não lê clientes, não apaga nada.
- O token fica em `chrome.storage.local` e **só o service worker** o usa —
  a página do WhatsApp e o painel nunca têm acesso a ele.
- Permissões: `storage` + `https://web.whatsapp.com/*`. O acesso ao domínio
  do seu PrintOS é pedido em runtime, só para a origem que você configurar.
- Revogue o token quando quiser em **PrintOS → Configurações → Extensão do
  WhatsApp Web** (cada dispositivo tem o seu).

## Instalar (modo desenvolvedor)

1. No PrintOS: **Configurações → Extensão do WhatsApp Web → Gerar token**.
   Copie o token (`pit_…`) — ele só aparece uma vez.
2. Chrome/Edge: abra `chrome://extensions`, ligue **Modo do desenvolvedor**,
   clique **Carregar sem compactação** e aponte para esta pasta `extensao/`.
3. Clique no ícone da extensão → **Opções** → cole a **URL do PrintOS** e o
   **token** → Salvar (vai pedir permissão para o domínio do PrintOS).
4. Abra `web.whatsapp.com`, entre numa conversa: o botão **＋ Pedido**
   aparece no topo.

## Uso

1. Cliente manda o pedido no WhatsApp.
2. Você clica em **＋ Pedido**.
3. Confere cliente / itens / prazo no painel (já vem pré-preenchido) e
   clica **Criar pedido**.
4. Aparece “✅ Pedido #N” com link. O pedido entra em *Produção* como
   *aguardando arte*, com a conversa e a arte anexadas.

## Limitações

- Só funciona no **WhatsApp Web / Desktop** (não no celular).
- Os seletores de leitura do WhatsApp Web podem quebrar quando a Meta muda
  o layout — aí `content.js` precisa de ajuste.
- A captura da arte pega a **imagem mais recente** visível na conversa; se
  falhar, o pedido é criado sem anexo (você sobe depois pelo site).
