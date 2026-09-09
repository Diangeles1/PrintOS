# Integração WhatsApp — registro de pedidos

Bot **de informação**, não de atendimento. Ninguém fala com o cliente:
o dono/funcionário **encaminha** a mensagem do cliente para o número do
PrintOS, o bot monta o pedido e responde com botões **✅ Confirmar ·
✏️ Editar · ❌ Ignorar**. No Confirmar, o pedido entra no site
(`aguardando_arte`, origem `whatsapp`, com o texto original salvo).

## Como funciona

```
cliente → WhatsApp da gráfica
        ↳ funcionário encaminha p/ o número do PrintOS
              ↳ webhook /api/whatsapp/webhook
                   ├─ acha a conta pelo número de quem encaminhou (whatsapp_numeros)
                   ├─ heurística: parece pedido? extrai cliente / item / qtd
                   ├─ grava whatsapp_pendentes
                   └─ manda cartão com botões
        funcionário toca ✅ → cria pedido + item, responde com o link
```

- Cada número (dono + funcionários) é vinculado em **Configurações →
  Pedidos pelo WhatsApp**. Número não vinculado recebe uma resposta
  pedindo para o dono cadastrá-lo.
- `✏️ Editar` → o bot pede `Cliente | Item | Quantidade` e refaz o cartão.
- Dedupe por `wa_message_id` (a Meta reentrega em timeout).

## Configurar (Meta / Cloud API)

1. **Meta for Developers** → criar app tipo *Business* → adicionar produto
   **WhatsApp**.
2. Em *API Setup*: pegue o **Temporary access token** (para testes) ou
   gere um **permanent token** (System User com permissão
   `whatsapp_business_messaging`), e o **Phone number ID**. Para produção,
   registre um número real ou use um BSP (360dialog, Twilio, Gupshup…).
3. **Webhook**: URL `https://SEU_DOMINIO/api/whatsapp/webhook`, *Verify
   token* = o valor que você puser em `WHATSAPP_VERIFY_TOKEN`. Assine o
   campo **messages**.
4. **App Secret**: Configurações do app → Básico → copie para
   `WHATSAPP_APP_SECRET` (valida a assinatura `X-Hub-Signature-256`).

## Variáveis de ambiente

Veja `.env.example`. Necessárias para a integração:

| var | onde pegar |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `WHATSAPP_TOKEN` | Meta → WhatsApp → API Setup |
| `WHATSAPP_PHONE_ID` | Meta → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | você inventa; repita na config do webhook |
| `WHATSAPP_APP_SECRET` | Meta → Configurações do app → Básico |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (para o link no retorno) |
| `NEXT_PUBLIC_WHATSAPP_BOT_NUMERO` | dígitos do número do bot, p/ mostrar em Configurações |

Sem `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` o webhook aceita mas não envia
resposta (fica logado no servidor).

## Rodar local

O webhook precisa de URL pública. Use um túnel:

```
npx cloudflared tunnel --url http://localhost:3000
# ou: ngrok http 3000
```

e aponte o webhook da Meta para `<url-do-túnel>/api/whatsapp/webhook`.

## Migração

`supabase/migrations/0009_whatsapp.sql` — `whatsapp_numeros`,
`whatsapp_pendentes`, `whatsapp_processados` e as colunas
`pedidos.origem` / `pedidos.origem_texto`.
