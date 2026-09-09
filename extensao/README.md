# Extensão PrintOS · Pedido do WhatsApp Web

Um botão flutuante **“+ Pedido”** no canto da tela do WhatsApp Web (só
aparece quando há uma conversa aberta). Um clique abre um painel onde o
patrão ou o funcionário registra o pedido na mão, rápido: **o que é**,
**valor**, **prazo** e **forma de pagamento**. O nome do contato e a
última arte da conversa já vêm preenchidos. Ao enviar, o pedido cai no
PrintOS como *aguardando arte*.

Não é bot: **só lê a tela quando você clica**, não interpreta a conversa,
não envia mensagem, não roda nada em segundo plano. Quem decide o que
registrar é a pessoa, no painel.

O botão fica num **Shadow DOM isolado**: não é enfiado no HTML do
WhatsApp, não mexe no layout dele, e o código do WhatsApp não enxerga o
botão (nem o botão enxerga o do WhatsApp). Para mudar a posição, ajuste
`right` / `bottom` na `.fab` dentro de `content.js`.

## Segurança

- Usa um **token de ingestão** com escopo mínimo: só `POST /api/ingest/pedido`
  (criar pedido + anexar arte). Não lê clientes, não apaga nada.
- O token fica em `chrome.storage.local` e **só o service worker** o usa.
  A página do WhatsApp e o painel nunca têm acesso a ele.
- Permissões: `storage` + `https://web.whatsapp.com/*`. O acesso ao domínio
  do seu PrintOS é pedido em runtime, só para a origem que você configurar.
- Revogue o token quando quiser em **PrintOS → Configurações → Extensão do
  WhatsApp Web** (cada dispositivo tem o seu).

## Instalar (modo desenvolvedor)

1. No PrintOS: **Configurações → Extensão do WhatsApp Web → Gerar token**.
   Copie o token (`pit_…`). Ele só aparece uma vez.
2. Chrome/Edge: abra `chrome://extensions`, ligue **Modo do desenvolvedor**,
   clique **Carregar sem compactação** e aponte para esta pasta `extensao/`.
3. Clique no ícone da extensão → **Opções**, cole a **URL do PrintOS** e o
   **token**, e Salvar (vai pedir permissão para o domínio do PrintOS).
4. Abra `web.whatsapp.com`, entre numa conversa: o botão flutuante
   **+ Pedido** aparece no canto inferior direito.

> **Atualizando de uma versão anterior?** A ordem importa:
> 1. `chrome://extensions`, no **card da extensão** (não na tela de Erros),
>    clique no ícone **↻** (recarregar). A versão exibida tem que mudar.
> 2. **Feche e reabra** a aba do `web.whatsapp.com` (só F5 às vezes não
>    basta). Sem isso, a aba continua com o script antigo e aparece o erro
>    `Extension context invalidated`, que é inofensivo e some ao recarregar
>    a aba.

## Uso

1. Cliente fecha o pedido pelo WhatsApp.
2. Você clica em **+ Pedido** no canto da tela.
3. No painel: cliente (já vem do contato), **o que é** (um ou mais itens),
   **valor**, **prazo** e **forma de pagamento**. Observações se precisar.
4. Em **Arte do cliente**, o painel mostra as imagens grandes da conversa.
   **Toque nas que forem a arte** (pode marcar mais de uma: frente/verso).
   Nada é anexado sem você marcar.
5. Clica **Criar pedido**. Aparece “✅ Pedido #N” com link. O pedido entra
   em *Produção* como *aguardando arte*, com as imagens marcadas anexadas.

Tudo é digitado e escolhido por você. A extensão não “adivinha” o pedido
nem escolhe a arte sozinha.

## Limitações

- Só funciona no **WhatsApp Web / Desktop** (não no celular).
- O botão em si é estável (Shadow DOM isolado), mas a **leitura** do nome
  do contato e da arte usa a estrutura da tela do WhatsApp e pode parar de
  funcionar quando a Meta muda o layout. Nesse caso o `content.js` precisa
  de ajuste. O registro continua funcionando: é só digitar no painel.
- A lista de artes vem das **imagens grandes já carregadas** na conversa
  aberta (as últimas ~8, ignorando figurinhas e miniaturas). Se a arte
  ainda não apareceu na tela, role a conversa até ela antes de clicar; ou
  crie o pedido sem anexo e suba a arte depois pelo site.
- Arte em **PDF / CDR / AI** não entra pela extensão (só imagem). Anexe
  pelo site.
