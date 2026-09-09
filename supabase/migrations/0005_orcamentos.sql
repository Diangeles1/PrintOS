-- PrintOS — Orçamentos (cabeçalho + itens). Idempotente.

-- 1) Cabeçalho ------------------------------------------------------------
create table if not exists public.orcamentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero      integer not null default 0,
  cliente_id  uuid references public.clientes (id) on delete set null,
  cliente_nome text,
  status      text not null default 'rascunho'
                check (status in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  validade    date,
  desconto    numeric(12, 2) not null default 0 check (desconto >= 0),
  subtotal    numeric(12, 2) not null default 0,
  total       numeric(12, 2) generated always as (greatest(subtotal - desconto, 0)) stored,
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint orcamentos_cliente_nome_tam check (cliente_nome is null or length(cliente_nome) <= 200)
);
create index if not exists orcamentos_user_idx on public.orcamentos (user_id, created_at desc);
create index if not exists orcamentos_cliente_idx on public.orcamentos (cliente_id);

-- 2) Itens -------------------------------------------------------------------
create table if not exists public.orcamento_itens (
  id             uuid primary key default gen_random_uuid(),
  orcamento_id   uuid not null references public.orcamentos (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  servico_id     uuid references public.servicos (id) on delete set null,
  descricao      text not null check (length(btrim(descricao)) between 1 and 300),
  quantidade     numeric(12, 3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12, 2) not null default 0 check (preco_unitario >= 0),
  subtotal       numeric(12, 2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists orcamento_itens_orc_idx on public.orcamento_itens (orcamento_id, ordem);
create index if not exists orcamento_itens_user_idx on public.orcamento_itens (user_id);

-- 3) Triggers ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists orcamentos_set_updated_at on public.orcamentos;
create trigger orcamentos_set_updated_at
  before update on public.orcamentos
  for each row execute function public.set_updated_at();

-- numero sequencial por conta
create or replace function public.orcamento_set_numero()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero
    from public.orcamentos where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orcamentos_numero on public.orcamentos;
create trigger orcamentos_numero
  before insert on public.orcamentos
  for each row execute function public.orcamento_set_numero();

-- item so entra num orcamento do proprio usuario
create or replace function public.orcamento_item_dono()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.orcamentos o
    where o.id = new.orcamento_id and o.user_id = new.user_id
  ) then
    raise exception 'Item so pode ser adicionado num orcamento do proprio usuario.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists orcamento_itens_dono on public.orcamento_itens;
create trigger orcamento_itens_dono
  before insert on public.orcamento_itens
  for each row execute function public.orcamento_item_dono();

-- recalcula o subtotal do cabecalho a partir dos itens
create or replace function public.orcamento_recalc()
returns trigger language plpgsql set search_path = '' as $$
declare
  alvo uuid := coalesce(new.orcamento_id, old.orcamento_id);
begin
  update public.orcamentos o
  set subtotal = coalesce(
        (select sum(i.subtotal) from public.orcamento_itens i where i.orcamento_id = alvo), 0
      )
  where o.id = alvo;
  return null;
end;
$$;

drop trigger if exists orcamento_itens_recalc on public.orcamento_itens;
create trigger orcamento_itens_recalc
  after insert or update or delete on public.orcamento_itens
  for each row execute function public.orcamento_recalc();

-- 4) Grants + RLS ------------------------------------------------------------
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;

revoke all on public.orcamentos from anon;
revoke all on public.orcamento_itens from anon;
grant select, insert, update, delete on public.orcamentos to authenticated;
grant select, insert, update, delete on public.orcamento_itens to authenticated;

drop policy if exists "orcamentos_all_own" on public.orcamentos;
create policy "orcamentos_all_own" on public.orcamentos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "orcamento_itens_all_own" on public.orcamento_itens;
create policy "orcamento_itens_all_own" on public.orcamento_itens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
