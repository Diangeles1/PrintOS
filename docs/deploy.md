# Deploy do PrintOS — runbook

Stack: Next.js 16 (App Router) + Supabase. Deploy recomendado: **Vercel** (Next
nativo) + o projeto Supabase que já existe.

---

## 1. Variáveis de ambiente (no host de deploy)

| Variável | Obrigatória | O que é |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | anon/publishable key (Supabase → Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role key. **NUNCA** expor no client. Só o servidor usa. |
| `NEXT_PUBLIC_APP_URL` | ✅ | **URL pública final** do app (ex.: `https://app.suagrafica.com.br`). Usada nos links de WhatsApp e aprovação de arte. Sem barra no fim. |
| `SUPERADMIN_EMAILS` | ✅ (p/ o console) | e-mails com acesso a `/admin`, separados por vírgula. Ex.: `voce@gmail.com` |
| `WHATSAPP_TOKEN` | opcional | Meta Cloud API — só se usar o modelo "encaminhar" (`docs/whatsapp.md`) |
| `WHATSAPP_PHONE_ID` | opcional | idem |
| `WHATSAPP_VERIFY_TOKEN` | opcional | token que você inventa, repetido na config do webhook na Meta |
| `WHATSAPP_APP_SECRET` | opcional | valida a assinatura do webhook |
| `NEXT_PUBLIC_WHATSAPP_BOT_NUMERO` | opcional | número do bot mostrado em Configurações (só dígitos) |

> `SUPERADMIN_EMAILS` de teste (`e2e-admin@printos.test`) só faz sentido no
> ambiente de CI. Não coloque em produção.

---

## 2. Banco (Supabase)

1. **Migrações** — aplique em ordem tudo em `supabase/migrations/` (`0001` → `0015`).
   Via SQL Editor do painel, ou Supabase CLI (`supabase db push`).
2. **Auth → URL Configuration**:
   - Site URL = `NEXT_PUBLIC_APP_URL`
   - Redirect URLs: adicione `${NEXT_PUBLIC_APP_URL}/auth/callback`
3. **Auth → Providers** (se for usar login social): habilite Google e/ou Azure e
   preencha Client ID / Secret.
4. **Storage**: os buckets `logos` (público) e `pedido-arquivos` (privado) são
   criados pelas migrações `0008` e `0010`. Confira que existem.
5. **Backups**: confirme que o Point-in-Time Recovery / backup diário está ligado
   no plano. Faça **um teste de restore** antes de ter cliente pagante.

---

## 3. Segurança — antes de abrir pra clientes

- [ ] **Revogar o Personal Access Token** usado no desenvolvimento:
      supabase.com/dashboard/account/tokens. (Era usado pelos scripts via
      Management API; produção não precisa dele.)
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` **não** aparece em nenhuma var
      `NEXT_PUBLIC_*` nem no bundle do client.
- [ ] HTTPS obrigatório (Vercel já faz). O middleware manda `Strict-Transport-Security`
      quando detecta HTTPS, e `Content-Security-Policy` em toda resposta.
- [ ] `SUPERADMIN_EMAILS` com **só os e-mails certos**.
- [ ] RLS: a suíte `npm run test:isolamento` valida que uma gráfica não vê dados
      de outra. Rode contra staging antes de cada release grande.

---

## 4. Deploy (Vercel)

1. Conecte o repositório. Framework: Next.js (autodetect).
2. Cole as variáveis da seção 1 em **Project → Settings → Environment Variables**
   (Production + Preview).
3. Build command padrão (`next build`). Output padrão.
4. Deploy. Depois aponte o domínio custom e atualize `NEXT_PUBLIC_APP_URL` +
   as Redirect URLs do Supabase para esse domínio, e re-deploy.

---

## 5. Checagem pós-deploy

- [ ] `GET /` redireciona pro login (deslogado) ou dashboard (logado)
- [ ] Criar conta → cai em "Como podemos te chamar?" → dashboard
- [ ] Login Google/Microsoft (se habilitado) volta pro app sem erro
- [ ] Criar cliente / orçamento / pedido / venda rápida / abrir caixa
- [ ] `/aprovar/<token>` abre pra quem não tem conta (gerar um link num pedido)
- [ ] `/admin` só abre pro e-mail em `SUPERADMIN_EMAILS`
- [ ] Headers: `curl -sI https://SEU_DOMINIO | grep -i "content-security\|strict-transport\|x-frame"`
- [ ] Extensão do WhatsApp: gerar token em Configurações, configurar a extensão
      com a URL de produção, criar um pedido de teste

---

## 6. CI

`.github/workflows/ci.yml` roda a cada push:
- sempre: `tsc --noEmit` + `next build`
- se os segredos do Supabase estiverem no repo: `test:tudo` (86 asserts) + Playwright (5)

Segredos a cadastrar em **GitHub → Settings → Secrets → Actions**:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPERADMIN_EMAILS` (inclua `e2e-admin@printos.test`).
Use um **projeto Supabase de staging** pro CI, não o de produção.
