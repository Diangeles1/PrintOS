-- PrintOS — Pedidos (cabeçalho + itens). Idempotente.

create table if not exists public.pedidos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero       integer not null default 0,
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  cliente_id   uuid references public.clientes (id) on delete set null,
  cliente_nome text,
  status       text not null default 'aguardando_arte'
                 check (status in ('aguardando_arte', 'em_producao', 'pronto', 'entregue', 'cancelado')),
  prazo        date,
  desconto     numeric(12, 2) not null default 0 check (desconto >= 0),
  subtotal     numeric(12, 2) not null default 0,
  total        numeric(12, 2) generated always as (greatest(subtotal - desconto, 0)) stored,
  observacoes  text check (observacoes is null or length(observacoes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint pedidos_cliente_nome_tam check (cliente_nome is null or length(cliente_nome) <= 200)
);
create index if not exists pedidos_user_idx on public.pedidos (user_id, created_at desc);
create index if not exists pedidos_status_idx on public.pedidos (user_id, status);
create index if not exists pedidos_orcamento_idx on public.pedidos (orcamento_id);

create table if not exists public.pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  servico_id     uuid references public.servicos (id) on delete set null,
  descricao      text not null check (length(btrim(descricao)) between 1 and 300),
  quantidade     numeric(12, 3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12, 2) not null default 0 check (preco_unitario >= 0),
  subtotal       numeric(12, 2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists pedido_itens_ped_idx on public.pedido_itens (pedido_id, ordem);
create index if not exists pedido_itens_user_idx on public.pedido_itens (user_id);

-- Triggers -----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

create or replace function public.pedido_set_numero()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero
    from public.pedidos where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_numero on public.pedidos;
create trigger pedidos_numero
  before insert on public.pedidos
  for each row execute function public.pedido_set_numero();

create or replace function public.pedido_item_dono()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.pedidos p
    where p.id = new.pedido_id and p.user_id = new.user_id
  ) then
    raise exception 'Item so pode ser adicionado num pedido do proprio usuario.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists pedido_itens_dono on public.pedido_itens;
create trigger pedido_itens_dono
  before insert on public.pedido_itens
  for each row execute function public.pedido_item_dono();

create or replace function public.pedido_recalc()
returns trigger language plpgsql set search_path = '' as $$
declare
  alvo uuid := coalesce(new.pedido_id, old.pedido_id);
begin
  update public.pedidos p
  set subtotal = coalesce(
        (select sum(i.subtotal) from public.pedido_itens i where i.pedido_id = alvo), 0
      )
  where p.id = alvo;
  return null;
end;
$$;

drop trigger if exists pedido_itens_recalc on public.pedido_itens;
create trigger pedido_itens_recalc
  after insert or update or delete on public.pedido_itens
  for each row execute function public.pedido_recalc();

-- Grants + RLS ------------------------------------------------------------
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

revoke all on public.pedidos from anon;
revoke all on public.pedido_itens from anon;
grant select, insert, update, delete on public.pedidos to authenticated;
grant select, insert, update, delete on public.pedido_itens to authenticated;

drop policy if exists "pedidos_all_own" on public.pedidos;
create policy "pedidos_all_own" on public.pedidos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "pedido_itens_all_own" on public.pedido_itens;
create policy "pedido_itens_all_own" on public.pedido_itens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Função: gera um pedido a partir de um orçamento aprovado ---------------
create or replace function public.gerar_pedido_do_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_orc public.orcamentos%rowtype;
  v_pedido_id uuid;
begin
  select * into v_orc from public.orcamentos
  where id = p_orcamento_id and user_id = v_uid;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  insert into public.pedidos (user_id, orcamento_id, cliente_id, cliente_nome, desconto, observacoes)
  values (v_uid, v_orc.id, v_orc.cliente_id, v_orc.cliente_nome, v_orc.desconto, v_orc.observacoes)
  returning id into v_pedido_id;

  insert into public.pedido_itens (pedido_id, user_id, servico_id, descricao, quantidade, preco_unitario, ordem)
  select v_pedido_id, v_uid, i.servico_id, i.descricao, i.quantidade, i.preco_unitario, i.ordem
  from public.orcamento_itens i
  where i.orcamento_id = v_orc.id;

  return v_pedido_id;
end;
$$;

grant execute on function public.gerar_pedido_do_orcamento(uuid) to authenticated;
