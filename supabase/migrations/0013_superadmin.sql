-- PrintOS — área do SuperADMIN. Idempotente.
--
-- O SuperADMIN é definido por ALLOWLIST DE E-MAIL na env `SUPERADMIN_EMAILS`
-- (nunca por linha em tabela — não dá pra escalar privilégio via SQL/insert).
-- Todo acesso a dados de outras contas passa pelo service_role no servidor,
-- atrás da verificação de allowlist. Aqui só entra:
--   1) tabela de auditoria (append-only, service_role apenas)
--   2) função de resumo das contas (junta auth.users + rollups)

-- 1) Auditoria -------------------------------------------------------------
create table if not exists public.admin_audit (
  id           uuid primary key default gen_random_uuid(),
  actor_email  text not null,
  acao         text not null,
  alvo_user_id uuid,
  alvo_email   text,
  detalhe      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint admin_audit_acao_tam check (length(acao) <= 60)
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_alvo_idx on public.admin_audit (alvo_user_id);

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
-- sem policy: só o service_role (que ignora RLS) lê/escreve.

-- 2) Resumo das contas para a lista do painel ----------------------------
-- security definer + owner postgres: pode ler auth.users. Sem acesso a
-- anon/authenticated — só o service_role chama.
create or replace function public.admin_resumo_contas()
returns table (
  user_id            uuid,
  email              text,
  display_name       text,
  criado_em          timestamptz,
  ultimo_login       timestamptz,
  email_confirmado   boolean,
  banido_ate         timestamptz,
  empresa_nome       text,
  n_clientes         bigint,
  n_pedidos          bigint,
  n_orcamentos       bigint,
  ultimo_pedido_em   timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    nullif(btrim(coalesce(u.raw_user_meta_data->>'display_name', '')), '') as display_name,
    u.created_at,
    u.last_sign_in_at,
    (u.email_confirmed_at is not null) as email_confirmado,
    u.banned_until,
    e.nome as empresa_nome,
    (select count(*) from public.clientes c where c.user_id = u.id)   as n_clientes,
    (select count(*) from public.pedidos p where p.user_id = u.id)    as n_pedidos,
    (select count(*) from public.orcamentos o where o.user_id = u.id) as n_orcamentos,
    (select max(p.created_at) from public.pedidos p where p.user_id = u.id) as ultimo_pedido_em
  from auth.users u
  left join public.empresa e on e.user_id = u.id
  order by u.created_at desc
$$;

alter function public.admin_resumo_contas() owner to postgres;
revoke all on function public.admin_resumo_contas() from public, anon, authenticated;
