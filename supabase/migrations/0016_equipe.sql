-- PrintOS — Equipe (múltiplos usuários por gráfica). NÃO idempotente de forma
-- perfeita (usa create policy), mas os drops tornam re-execução segura.
--
-- MODELO
--   Cada gráfica = o user_id do DONO. `grafica_membros` liga qualquer usuário
--   (dono ou funcionário) a uma gráfica + papel.
--   Os dados continuam gravados em `<tabela>.user_id = <id da gráfica>`.
--   A RLS deixa de ser `auth.uid() = user_id` e passa a ser
--   `user_id = public.minha_grafica()` — que resolve o dono a partir do
--   membro logado. Tabelas sensíveis (caixa, orçamentos, config, whatsapp)
--   ficam só para quem tem papel 'dono'.

-- ========================================================================
-- 1) tabela de membros + funções
-- ========================================================================
create table if not exists public.grafica_membros (
  id          uuid primary key default gen_random_uuid(),
  grafica_id  uuid not null references auth.users (id) on delete cascade,
  membro_id   uuid not null references auth.users (id) on delete cascade,
  papel       text not null check (papel in ('dono', 'funcionario')),
  nome        text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (grafica_id, membro_id)
);
-- um usuário só pode estar ATIVO em uma gráfica por vez
create unique index if not exists grafica_membros_um_ativo_por_membro
  on public.grafica_membros (membro_id) where ativo;
create index if not exists grafica_membros_grafica_idx on public.grafica_membros (grafica_id);

-- gráfica do usuário logado (dono → ele mesmo; funcionário → o dono).
-- security definer + owner postgres → ignora RLS de grafica_membros (sem recursão).
create or replace function public.minha_grafica()
returns uuid language sql stable security definer set search_path = '' as $$
  select grafica_id from public.grafica_membros
  where membro_id = (select auth.uid()) and ativo
  limit 1
$$;
alter function public.minha_grafica() owner to postgres;

create or replace function public.sou_dono()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.grafica_membros
    where membro_id = (select auth.uid()) and ativo and papel = 'dono'
  )
$$;
alter function public.sou_dono() owner to postgres;

-- todo novo cadastro vira DONO da própria gráfica
create or replace function public.novo_usuario_dono()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.grafica_membros (grafica_id, membro_id, papel, nome)
  values (new.id, new.id, 'dono', nullif(new.raw_user_meta_data->>'display_name', ''))
  on conflict (grafica_id, membro_id) do nothing;
  return new;
end $$;
alter function public.novo_usuario_dono() owner to postgres;

drop trigger if exists on_auth_user_created_membro on auth.users;
create trigger on_auth_user_created_membro
  after insert on auth.users
  for each row execute function public.novo_usuario_dono();

-- backfill: todos os usuários atuais são donos da própria gráfica
insert into public.grafica_membros (grafica_id, membro_id, papel)
select id, id, 'dono' from auth.users
on conflict (grafica_id, membro_id) do nothing;

-- RLS da própria tabela de membros
alter table public.grafica_membros enable row level security;
revoke all on public.grafica_membros from anon;
grant select, insert, update, delete on public.grafica_membros to authenticated;

drop policy if exists "gm_select" on public.grafica_membros;
create policy "gm_select" on public.grafica_membros for select to authenticated
  using (membro_id = (select auth.uid()) or grafica_id = public.minha_grafica());

drop policy if exists "gm_dono_insert" on public.grafica_membros;
create policy "gm_dono_insert" on public.grafica_membros for insert to authenticated
  with check (grafica_id = public.minha_grafica() and public.sou_dono());

drop policy if exists "gm_dono_update" on public.grafica_membros;
create policy "gm_dono_update" on public.grafica_membros for update to authenticated
  using (grafica_id = public.minha_grafica() and public.sou_dono()
         and not (papel = 'dono' and membro_id = grafica_id))
  with check (grafica_id = public.minha_grafica() and public.sou_dono());

drop policy if exists "gm_dono_delete" on public.grafica_membros;
create policy "gm_dono_delete" on public.grafica_membros for delete to authenticated
  using (grafica_id = public.minha_grafica() and public.sou_dono()
         and not (papel = 'dono' and membro_id = grafica_id));

-- ========================================================================
-- 2) quem fez o pedido (pra somar venda por funcionário)
-- ========================================================================
alter table public.pedidos add column if not exists criado_por uuid references auth.users (id);
alter table public.pedidos alter column criado_por set default auth.uid();
create index if not exists pedidos_criado_por_idx on public.pedidos (criado_por, created_at desc);

-- ========================================================================
-- 3) defaults de user_id: passa a ser a gráfica do membro
-- ========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','materiais','servicos','empresa','orcamentos','orcamento_itens',
    'pedidos','pedido_itens','caixa_sessoes','caixa_movimentos','pedido_aprovacoes',
    'pedido_arquivos','ingest_tokens','whatsapp_numeros','whatsapp_pendentes'
  ]
  loop
    execute format('alter table public.%I alter column user_id set default public.minha_grafica()', t);
  end loop;
end $$;

-- ========================================================================
-- 4) RLS reescrita
-- ========================================================================
-- dropa todas as policies antigas das tabelas de dados
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'clientes','materiais','servicos','empresa','orcamentos','orcamento_itens',
    'pedidos','pedido_itens','caixa_sessoes','caixa_movimentos','pedido_aprovacoes',
    'pedido_arquivos','ingest_tokens','whatsapp_numeros','whatsapp_pendentes'
  ]
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

-- --- acesso da GRÁFICA inteira (dono + funcionário): serviços e materiais ---
create policy "servicos_grafica" on public.servicos for all to authenticated
  using (user_id = public.minha_grafica()) with check (user_id = public.minha_grafica());
create policy "materiais_grafica" on public.materiais for all to authenticated
  using (user_id = public.minha_grafica()) with check (user_id = public.minha_grafica());

-- --- clientes: membro lê/cria/edita; só dono apaga ---
create policy "clientes_sel" on public.clientes for select to authenticated
  using (user_id = public.minha_grafica());
create policy "clientes_ins" on public.clientes for insert to authenticated
  with check (user_id = public.minha_grafica());
create policy "clientes_upd" on public.clientes for update to authenticated
  using (user_id = public.minha_grafica()) with check (user_id = public.minha_grafica());
create policy "clientes_del" on public.clientes for delete to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono());

-- --- pedidos + itens: membro lê/cria (venda rápida); só dono altera/apaga ---
create policy "pedidos_sel" on public.pedidos for select to authenticated
  using (user_id = public.minha_grafica());
create policy "pedidos_ins" on public.pedidos for insert to authenticated
  with check (user_id = public.minha_grafica());
create policy "pedidos_upd" on public.pedidos for update to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "pedidos_del" on public.pedidos for delete to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono());

create policy "pitens_sel" on public.pedido_itens for select to authenticated
  using (user_id = public.minha_grafica());
create policy "pitens_ins" on public.pedido_itens for insert to authenticated
  with check (user_id = public.minha_grafica());
create policy "pitens_upd" on public.pedido_itens for update to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "pitens_del" on public.pedido_itens for delete to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono());

-- --- empresa: membro LÊ (logo/nome nos docs); só dono ESCREVE ---
create policy "empresa_sel" on public.empresa for select to authenticated
  using (user_id = public.minha_grafica());
create policy "empresa_dono" on public.empresa for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());

-- --- SÓ DONO: caixa, orçamentos, aprovações, arquivos, tokens, whatsapp ---
create policy "caixa_sessoes_dono" on public.caixa_sessoes for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "caixa_mov_dono" on public.caixa_movimentos for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "orcamentos_dono" on public.orcamentos for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "orc_itens_dono" on public.orcamento_itens for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "paprov_dono" on public.pedido_aprovacoes for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "parq_dono" on public.pedido_arquivos for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "ingest_dono" on public.ingest_tokens for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "wa_num_dono" on public.whatsapp_numeros for all to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono())
  with check (user_id = public.minha_grafica() and public.sou_dono());
create policy "wa_pend_dono" on public.whatsapp_pendentes for select to authenticated
  using (user_id = public.minha_grafica() and public.sou_dono());

-- ========================================================================
-- 5) triggers de posse (parent-ownership) já comparam new.user_id com o
--    pai; como ambos agora são a gráfica, continuam válidos. Sem mudança.
-- ========================================================================
