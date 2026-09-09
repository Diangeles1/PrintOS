-- PrintOS — Configurações da empresa + bucket de logos. Idempotente.

create table if not exists public.empresa (
  user_id                   uuid primary key default auth.uid()
                              references auth.users (id) on delete cascade,
  nome                      text,
  documento                 text,
  telefone                  text,
  endereco                  text,
  logo_url                  text,
  orcamento_validade_dias   integer not null default 15
                              check (orcamento_validade_dias between 0 and 365),
  orcamento_condicoes       text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint empresa_nome_tam      check (nome is null or length(nome) <= 200),
  constraint empresa_doc_tam       check (documento is null or length(documento) <= 32),
  constraint empresa_tel_tam       check (telefone is null or length(telefone) <= 40),
  constraint empresa_end_tam       check (endereco is null or length(endereco) <= 300),
  constraint empresa_logo_tam      check (logo_url is null or length(logo_url) <= 500),
  constraint empresa_condicoes_tam check (orcamento_condicoes is null or length(orcamento_condicoes) <= 2000)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists empresa_set_updated_at on public.empresa;
create trigger empresa_set_updated_at
  before update on public.empresa
  for each row execute function public.set_updated_at();

alter table public.empresa enable row level security;
revoke all on public.empresa from anon;
grant select, insert, update, delete on public.empresa to authenticated;

drop policy if exists "empresa_all_own" on public.empresa;
create policy "empresa_all_own" on public.empresa
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Bucket público para logos das gráficas -------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_read_public" on storage.objects;
create policy "logos_read_public" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos_insert_own" on storage.objects;
create policy "logos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "logos_update_own" on storage.objects;
create policy "logos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "logos_delete_own" on storage.objects;
create policy "logos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
