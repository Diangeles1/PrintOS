-- PrintOS — corrige "Database error deleting user". Idempotente.
--
-- Ao apagar um usuário (auth.users), o cascade apaga os itens em
-- public.orcamento_itens / public.pedido_itens. Os triggers AFTER de
-- recálculo então tentam UPDATE em public.orcamentos / public.pedidos
-- rodando como o papel `supabase_auth_admin`, que não tem GRANT nessas
-- tabelas → "permission denied" → a exclusão do usuário falha inteira.
--
-- Solução: as funções de recálculo passam a ser SECURITY DEFINER (rodam
-- como o dono das tabelas). Elas só somam os itens do próprio pai por id,
-- não decidem permissão com base em entrada do usuário — seguro como definer.
-- search_path travado em '' (nomes sempre qualificados).

create or replace function public.orcamento_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.pedido_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

-- garante que o dono das funções é o owner das tabelas (postgres)
alter function public.orcamento_recalc() owner to postgres;
alter function public.pedido_recalc() owner to postgres;
