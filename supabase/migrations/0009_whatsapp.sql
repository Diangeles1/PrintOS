-- PrintOS — Integração WhatsApp (registro de pedidos). Idempotente.

-- Origem do pedido -------------------------------------------------------------
alter table public.pedidos add column if not exists origem text not null default 'manual';
alter table public.pedidos drop constraint if exists pedidos_origem_check;
alter table public.pedidos add constraint pedidos_origem_check
  check (origem in ('manual', 'venda_rapida', 'orcamento', 'whatsapp'));
alter table public.pedidos add column if not exists origem_texto text;

-- Números de WhatsApp vinculados a cada conta --------------------------------
create table if not exists public.whatsapp_numeros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  numero     text not null,
  apelido    text,
  created_at timestamptz not null default now(),
  constraint whatsapp_numero_fmt    check (numero ~ '^[1-9][0-9]{9,15}$'),
  constraint whatsapp_apelido_tam   check (apelido is null or length(apelido) <= 60)
);
create unique index if not exists whatsapp_numeros_uidx on public.whatsapp_numeros (numero);
create index if not exists whatsapp_numeros_user_idx on public.whatsapp_numeros (user_id);

-- Pedidos candidatos, aguardando o dono confirmar no WhatsApp ---------------
create table if not exists public.whatsapp_pendentes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  de_numero   text not null,
  texto       text not null,
  cliente_sug text,
  item_sug    text,
  qtd_sug     numeric(12, 3),
  status      text not null default 'pendente'
                check (status in ('pendente', 'aguardando_edicao', 'confirmado', 'ignorado')),
  pedido_id   uuid references public.pedidos (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists whatsapp_pendentes_user_idx
  on public.whatsapp_pendentes (user_id, created_at desc);
create index if not exists whatsapp_pendentes_num_status_idx
  on public.whatsapp_pendentes (de_numero, status);

-- Dedupe de webhooks (a Meta reentrega) ------------------------------------
create table if not exists public.whatsapp_processados (
  wa_message_id text primary key,
  created_at    timestamptz not null default now()
);

-- RLS ----------------------------------------------------------------------
alter table public.whatsapp_numeros enable row level security;
alter table public.whatsapp_pendentes enable row level security;
alter table public.whatsapp_processados enable row level security;

revoke all on public.whatsapp_numeros from anon;
revoke all on public.whatsapp_pendentes from anon;
revoke all on public.whatsapp_processados from anon;
grant select, insert, update, delete on public.whatsapp_numeros to authenticated;
grant select on public.whatsapp_pendentes to authenticated;

drop policy if exists "wa_numeros_all_own" on public.whatsapp_numeros;
create policy "wa_numeros_all_own" on public.whatsapp_numeros
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "wa_pendentes_select_own" on public.whatsapp_pendentes;
create policy "wa_pendentes_select_own" on public.whatsapp_pendentes
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- whatsapp_processados: sem policy — só o service_role (webhook) acessa.
