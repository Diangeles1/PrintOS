-- PrintOS — Aprovação de arte pelo cliente (link público). Idempotente.
-- A gráfica gera um link por pedido, manda pro cliente no WhatsApp junto com
-- a arte. O cliente abre, vê a arte e responde: Aprovar / Solicitar alteração
-- / Recusar. A resposta entra pelo endpoint público (service_role), então o
-- papel `authenticated` só precisa de select/insert/delete nos próprios links.

create table if not exists public.pedido_aprovacoes (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token         text not null unique,                 -- vai na URL do link (hex, imprevisível)
  status        text not null default 'pendente'
                check (status in ('pendente', 'aprovado', 'recusado', 'alteracao')),
  comentario    text,                                 -- o que o cliente escreveu ao responder
  respondente   text,                                 -- nome que o cliente digitou (opcional)
  respondido_em timestamptz,
  revogado      boolean not null default false,
  expira_em     timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint aprov_token_fmt        check (token ~ '^[a-f0-9]{32,80}$'),
  constraint aprov_coment_tam       check (comentario is null or length(comentario) <= 2000),
  constraint aprov_respondente_tam  check (respondente is null or length(respondente) <= 120)
);
create index if not exists pedido_aprovacoes_ped_idx on public.pedido_aprovacoes (pedido_id);

alter table public.pedido_aprovacoes enable row level security;
revoke all on public.pedido_aprovacoes from anon;
grant select, insert, delete on public.pedido_aprovacoes to authenticated;

drop policy if exists "pedido_aprovacoes_own" on public.pedido_aprovacoes;
create policy "pedido_aprovacoes_own" on public.pedido_aprovacoes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- updated_at compartilhado (mesma função das outras tabelas)
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists pedido_aprovacoes_set_updated_at on public.pedido_aprovacoes;
create trigger pedido_aprovacoes_set_updated_at
  before update on public.pedido_aprovacoes
  for each row execute function public.set_updated_at();

-- o link só pode apontar para um pedido do próprio usuário (evita IDOR:
-- criar um link com meu user_id apontando pro pedido de outra gráfica)
create or replace function public.aprovacao_pedido_dono()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.pedidos p
    where p.id = new.pedido_id and p.user_id = new.user_id
  ) then
    raise exception 'O link de aprovacao so pode apontar para um pedido do proprio usuario.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists pedido_aprovacoes_dono on public.pedido_aprovacoes;
create trigger pedido_aprovacoes_dono
  before insert on public.pedido_aprovacoes
  for each row execute function public.aprovacao_pedido_dono();
