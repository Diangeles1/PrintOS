-- PrintOS — Ingestão externa (extensão do WhatsApp Web). Idempotente.
-- Tokens com escopo mínimo (só criar pedido + subir arte) e revogáveis.

-- 1) origem 'whatsapp_ext' -------------------------------------------------
alter table public.pedidos drop constraint if exists pedidos_origem_check;
alter table public.pedidos add constraint pedidos_origem_check
  check (origem in ('manual', 'venda_rapida', 'orcamento', 'whatsapp', 'whatsapp_ext'));

-- 2) tokens de ingestão --------------------------------------------------
create table if not exists public.ingest_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash   text not null unique,        -- sha256(hex) do token; o texto puro nunca é guardado
  label        text,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint ingest_label_tam check (label is null or length(label) <= 60),
  constraint ingest_hash_fmt  check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists ingest_tokens_user_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;
revoke all on public.ingest_tokens from anon;
-- o cliente pode listar (sem o hash), criar e revogar — nunca ler o hash nem atualizar.
grant select (id, user_id, label, last_used_at, created_at) on public.ingest_tokens to authenticated;
grant insert (id, user_id, token_hash, label) on public.ingest_tokens to authenticated;
grant delete on public.ingest_tokens to authenticated;

drop policy if exists "ingest_tokens_own" on public.ingest_tokens;
create policy "ingest_tokens_own" on public.ingest_tokens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3) arquivos do pedido (arte) -----------------------------------------------
create table if not exists public.pedido_arquivos (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  path       text not null,
  nome       text,
  mime       text,
  tamanho    integer,
  created_at timestamptz not null default now()
);
create index if not exists pedido_arquivos_ped_idx on public.pedido_arquivos (pedido_id);

alter table public.pedido_arquivos enable row level security;
revoke all on public.pedido_arquivos from anon;
grant select, delete on public.pedido_arquivos to authenticated;

drop policy if exists "pedido_arquivos_own" on public.pedido_arquivos;
create policy "pedido_arquivos_own" on public.pedido_arquivos
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 4) bucket PRIVADO para as artes -----------------------------------------
insert into storage.buckets (id, name, public)
values ('pedido-arquivos', 'pedido-arquivos', false)
on conflict (id) do nothing;

drop policy if exists "pedarq_read_own" on storage.objects;
create policy "pedarq_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pedido-arquivos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "pedarq_write_own" on storage.objects;
create policy "pedarq_write_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pedido-arquivos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "pedarq_delete_own" on storage.objects;
create policy "pedarq_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pedido-arquivos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
