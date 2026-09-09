-- PrintOS — tabela de Clientes
-- Rode este SQL uma vez no Supabase (Dashboard → SQL Editor → New query).
-- É seguro rodar de novo: usa IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

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
  updated_at  timestamptz not null default now()
);

create index if not exists clientes_user_id_idx on public.clientes (user_id);
create index if not exists clientes_user_nome_idx on public.clientes (user_id, nome);

-- 2) updated_at automático ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
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

-- 3) Row Level Security ----------------------------------------------------
-- Cada conta (gráfica) enxerga e mexe só nos próprios clientes.
alter table public.clientes enable row level security;

drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own"
  on public.clientes for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own"
  on public.clientes for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own"
  on public.clientes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own"
  on public.clientes for delete
  to authenticated
  using (user_id = auth.uid());
