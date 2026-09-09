-- PrintOS — token de ingestão: expiração + limite por token. Idempotente.
--
-- Antes: o token não expirava e o único limite era por CONTA (200 pedidos
-- whatsapp/h). Um token vazado dava pra criar 200 pedidos/h por tempo
-- indefinido. Agora cada token expira (180 dias por padrão) e tem seu
-- próprio limite de 120/h (janela deslizante simples mantida na própria linha).

alter table public.ingest_tokens
  add column if not exists expira_em      timestamptz not null default (now() + interval '180 days'),
  add column if not exists janela_inicio  timestamptz not null default now(),
  add column if not exists janela_contagem integer     not null default 0;

-- o client (authenticated) pode ver quando o token expira; janela_* ficam ocultos
grant select (id, user_id, label, last_used_at, created_at, expira_em)
  on public.ingest_tokens to authenticated;
