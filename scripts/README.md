# Bateria de testes — antes de lançar

Scripts em Node puro (sem dependência nova). Leem `.env.local`. Usam a
`service_role` para criar/apagar usuários de teste e semear dados.

| Comando | O que faz |
|---|---|
| `npm run test:isolamento` | **O teste crítico do SaaS.** Cria 2 contas reais e prova que a conta B não lê, altera, apaga nem "rouba" nenhum dado da conta A — tabela por tabela, com RLS ativa. Apaga as contas no fim. |
| `npm run test:fluxo` | Fluxo de negócio ponta a ponta numa conta: numero sequencial do orçamento, `subtotal` (trigger) e `total` (coluna gerada), desconto, RPC `gerar_pedido_do_orcamento`, caixa (sessão única, movimento só em sessão aberta), endpoint `/api/ingest/pedido` (201 + 401), endpoint `/api/aprovacao` (200 → move p/ produção → 409 na 2ª). |
| `npm run test:tudo` | Roda os dois acima em sequência. Sai com código ≠ 0 se qualquer assert falhar. |
| `npm run e2e` | **Playwright** (navegador real). `e2e/fluxo.spec.ts`: login → cliente → orçamento → aprovar → gerar pedido → produção. `e2e/admin.spec.ts`: console SuperADMIN — lista/detalhe/auditoria, gate do `/api/admin/acao` (header anti-CSRF + sessão), **teste de concorrência do incidente** (144 requests sem sessão tentando `banir` → 0 passam), e não-admin barrado. Precisa do servidor no ar (`npx next start -p 3100`) e de `e2e-admin@printos.test` em `SUPERADMIN_EMAILS`. |
| `APP_URL=http://localhost:3100 npm run test:fluxo` | Aponta os testes de endpoint pro servidor de produção em vez do dev :3000. |
| `npm run seed:demo -- voce@email.com` | Enche a SUA conta com ~12 clientes, 8 serviços, 6 materiais, caixa aberto, 5 orçamentos e ~21 pedidos em todos os status (com atrasados/hoje/futuros) — pra navegar o sistema "cheio". |
| `node scripts/limpar-demo.mjs voce@email.com` | Apaga todos os dados de negócio dessa conta (pede confirmação). Não apaga o login. |

## Antes de rodar

- `npm run test:fluxo` precisa do **dev server no ar** (`npm run dev`) para a parte de endpoints.
- Os testes criam usuários `teste+*@printos.test` no seu projeto Supabase e os apagam no fim. Se um teste travar no meio, sobra 1–2 usuários de teste — dá pra apagar no painel (Authentication → Users).
- Rode contra um projeto de **staging** se tiver. Contra produção, os testes limpam o que criam, mas é sempre um risco.

## Lendo o resultado

```
=== Isolamento entre contas (multi-tenant) ===
  PASS  A consegue inserir em clientes
  PASS  B NÃO lê clientes de A
  ...
--- Isolamento entre contas (multi-tenant): 55 PASS, 0 FAIL ---
```

Qualquer `FAIL` em "B NÃO lê/altera/apaga …" é **bloqueador de lançamento**: é vazamento entre gráficas.
