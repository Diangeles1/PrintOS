-- PrintOS — tabela de Materiais
-- Rode no Supabase (Dashboard -> SQL Editor -> New query). Idempotente.
-- "create table if not exists" NAO altera uma tabela ja existente.

create table if not exists public.materiais (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null,
  categoria      text,
  unidade        text not null default 'un',
  custo          numeric(12, 2) not null default 0,
  estoque        numeric(12, 3) not null default 0,
  estoque_minimo numeric(12, 3) not null default 0,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint materiais_nome_nao_vazio  check (length(btrim(nome)) > 0),
  constraint materiais_nome_tamanho    check (length(nome) <= 200),
  constraint materiais_cat_tamanho     check (categoria is null or length(categoria) <= 60),
  constraint materiais_unidade_tamanho check (length(unidade) between 1 and 12),
  constraint materiais_obs_tamanho     check (observacoes is null or length(observacoes) <= 2000),
  constraint materiais_custo_positivo  check (custo >= 0),
  constraint materiais_estoque_valido  check (estoque >= 0),
  constraint materiais_minimo_valido   check (estoque_minimo >= 0)
);

-- Cobre filtro por user_id, a FK do cascade e o ORDER BY nome.
create index if not exists materiais_user_nome_idx on public.materiais (user_id, nome);

-- Nome unico por conta (case-insensitive, ignora espacos nas pontas).
create unique index if not exists materiais_user_nome_uidx
  on public.materiais (user_id, lower(btrim(nome)));

-- updated_at automatico (reaproveita a funcao criada na migration de clientes;
-- recria por seguranca caso rode esta antes).
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

drop trigger if exists materiais_set_updated_at on public.materiais;
create trigger materiais_set_updated_at
  before update on public.materiais
  for each row execute function public.set_updated_at();

alter table public.materiais enable row level security;

revoke all on public.materiais from anon;
grant select, insert, update, delete on public.materiais to authenticated;

drop policy if exists "materiais_select_own" on public.materiais;
create policy "materiais_select_own" on public.materiais
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "materiais_insert_own" on public.materiais;
create policy "materiais_insert_own" on public.materiais
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "materiais_update_own" on public.materiais;
create policy "materiais_update_own" on public.materiais
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "materiais_delete_own" on public.materiais;
create policy "materiais_delete_own" on public.materiais
  for delete to authenticated
  using ((select auth.uid()) = user_id);
