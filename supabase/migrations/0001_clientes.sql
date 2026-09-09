-- PrintOS — tabela de Clientes
-- Rode este SQL uma vez no Supabase (Dashboard -> SQL Editor -> New query).
-- Idempotente: pode rodar de novo. OBS: "create table if not exists" NAO
-- altera uma tabela que ja existe — se voce rodou uma versao anterior,
-- avise para eu passar os ALTERs.

-- 1) Tabela ---------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null,
  tipo        text not null default 'pessoa' check (tipo in ('pessoa', 'empresa')),
  documento   text,
  email       text,
  telefone    text,
  endereco    text,
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint clientes_nome_nao_vazio check (length(btrim(nome)) > 0),
  constraint clientes_nome_tamanho   check (length(nome) <= 200),
  constraint clientes_doc_tamanho    check (documento is null or length(documento) <= 32),
  constraint clientes_email_tamanho  check (email is null or length(email) <= 320),
  constraint clientes_tel_tamanho    check (telefone is null or length(telefone) <= 40),
  constraint clientes_end_tamanho    check (endereco is null or length(endereco) <= 500),
  constraint clientes_obs_tamanho    check (observacoes is null or length(observacoes) <= 2000)
);

-- (user_id, nome) cobre o filtro por user_id, a FK do cascade e o ORDER BY nome.
create index if not exists clientes_user_nome_idx on public.clientes (user_id, nome);

-- 1 documento por conta (ignora vazio/nulo).
create unique index if not exists clientes_user_doc_uidx
  on public.clientes (user_id, documento)
  where documento is not null and documento <> '';

-- 2) updated_at automatico -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- 3) Grants + Row Level Security -----------------------------------------
alter table public.clientes enable row level security;

revoke all on public.clientes from anon;
grant select, insert, update, delete on public.clientes to authenticated;

-- Cada conta (grafica) enxerga e mexe so nos proprios clientes.
-- (select auth.uid()) e avaliado uma vez por query, nao por linha.
drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own" on public.clientes
  for delete to authenticated
  using ((select auth.uid()) = user_id);
