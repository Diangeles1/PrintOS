-- PrintOS — Servicos/Produtos vendaveis (catalogo de preco). Idempotente.

create table if not exists public.servicos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome        text not null,
  descricao   text,
  categoria   text,
  unidade     text not null default 'un',
  preco       numeric(12, 2) not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint servicos_nome_nao_vazio  check (length(btrim(nome)) > 0),
  constraint servicos_nome_tamanho    check (length(nome) <= 200),
  constraint servicos_desc_tamanho    check (descricao is null or length(descricao) <= 1000),
  constraint servicos_cat_tamanho     check (categoria is null or length(categoria) <= 60),
  constraint servicos_unidade_tamanho check (length(unidade) between 1 and 12),
  constraint servicos_preco_positivo  check (preco >= 0)
);

create index if not exists servicos_user_nome_idx on public.servicos (user_id, nome);
create unique index if not exists servicos_user_nome_uidx
  on public.servicos (user_id, lower(btrim(nome)));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists servicos_set_updated_at on public.servicos;
create trigger servicos_set_updated_at
  before update on public.servicos
  for each row execute function public.set_updated_at();

alter table public.servicos enable row level security;
revoke all on public.servicos from anon;
grant select, insert, update, delete on public.servicos to authenticated;

drop policy if exists "servicos_select_own" on public.servicos;
create policy "servicos_select_own" on public.servicos
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "servicos_insert_own" on public.servicos;
create policy "servicos_insert_own" on public.servicos
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "servicos_update_own" on public.servicos;
create policy "servicos_update_own" on public.servicos
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "servicos_delete_own" on public.servicos;
create policy "servicos_delete_own" on public.servicos
  for delete to authenticated using ((select auth.uid()) = user_id);
