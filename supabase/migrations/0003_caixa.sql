-- PrintOS — Caixa (sessoes + movimentos). Idempotente.

-- 1) Sessoes -----------------------------------------------------------------
create table if not exists public.caixa_sessoes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status           text not null default 'aberto' check (status in ('aberto', 'fechado')),
  valor_abertura   numeric(12, 2) not null default 0 check (valor_abertura >= 0),
  valor_esperado   numeric(12, 2) check (valor_esperado is null or valor_esperado >= 0),
  valor_fechamento numeric(12, 2) check (valor_fechamento is null or valor_fechamento >= 0),
  observacoes      text check (observacoes is null or length(observacoes) <= 2000),
  aberto_em        timestamptz not null default now(),
  fechado_em       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- No maximo uma sessao aberta por conta.
-- coluna adicionada depois da 1a versao desta migration
alter table public.caixa_sessoes
  add column if not exists valor_esperado numeric(12, 2);

create unique index if not exists caixa_um_aberto_por_usuario
  on public.caixa_sessoes (user_id) where status = 'aberto';
create index if not exists caixa_sessoes_user_idx
  on public.caixa_sessoes (user_id, aberto_em desc);

-- 2) Movimentos ------------------------------------------------------------
create table if not exists public.caixa_movimentos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sessao_id  uuid not null references public.caixa_sessoes (id) on delete cascade,
  tipo       text not null check (tipo in ('entrada', 'saida')),
  categoria  text check (categoria is null or length(categoria) <= 60),
  descricao  text not null check (length(btrim(descricao)) between 1 and 300),
  valor      numeric(12, 2) not null check (valor > 0),
  created_at timestamptz not null default now()
);
create index if not exists caixa_movimentos_sessao_idx
  on public.caixa_movimentos (sessao_id, created_at);
create index if not exists caixa_movimentos_user_idx
  on public.caixa_movimentos (user_id);

-- 3) Triggers ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists caixa_sessoes_set_updated_at on public.caixa_sessoes;
create trigger caixa_sessoes_set_updated_at
  before update on public.caixa_sessoes
  for each row execute function public.set_updated_at();

-- Movimento so entra em sessao aberta do proprio usuario.
create or replace function public.caixa_mov_sessao_aberta()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.caixa_sessoes s
    where s.id = new.sessao_id and s.status = 'aberto' and s.user_id = new.user_id
  ) then
    raise exception 'Movimento so pode ser lancado numa sessao de caixa aberta.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists caixa_mov_valida on public.caixa_movimentos;
create trigger caixa_mov_valida
  before insert on public.caixa_movimentos
  for each row execute function public.caixa_mov_sessao_aberta();

-- 4) Grants + RLS ------------------------------------------------------------
alter table public.caixa_sessoes enable row level security;
alter table public.caixa_movimentos enable row level security;

revoke all on public.caixa_sessoes from anon;
revoke all on public.caixa_movimentos from anon;
grant select, insert, update, delete on public.caixa_sessoes to authenticated;
grant select, insert, delete on public.caixa_movimentos to authenticated;

drop policy if exists "caixa_sessoes_all_own" on public.caixa_sessoes;
create policy "caixa_sessoes_all_own" on public.caixa_sessoes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "caixa_movimentos_select_own" on public.caixa_movimentos;
create policy "caixa_movimentos_select_own" on public.caixa_movimentos
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "caixa_movimentos_insert_own" on public.caixa_movimentos;
create policy "caixa_movimentos_insert_own" on public.caixa_movimentos
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "caixa_movimentos_delete_own" on public.caixa_movimentos;
create policy "caixa_movimentos_delete_own" on public.caixa_movimentos
  for delete to authenticated using ((select auth.uid()) = user_id);
