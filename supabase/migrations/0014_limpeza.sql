-- PrintOS — faxina do schema. Idempotente.
--
-- O template inicial (printos-v1-starter) criou ~17 tabelas em inglês
-- (orders, quotes, customers, profiles, companies, payments, …) e um
-- trigger `on_auth_user_created` → `handle_new_user()` que, a cada cadastro,
-- inseria em `companies` e `profiles`. A aplicação NUNCA usou nada disso:
-- ela trabalha com as tabelas em português (pedidos, orcamentos, clientes,
-- empresa…) e com `user_metadata.display_name`.
--
-- Aqui a gente remove: o trigger de signup do template + a função + todas as
-- tabelas órfãs. Nenhuma tabela viva referencia essas (verificado).

-- 1) trigger e função do template (rodavam à toa em todo cadastro)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

-- 2) tabelas órfãs do template (CASCADE resolve a ordem das FKs internas)
drop table if exists
  public.art_approvals,
  public.audit_logs,
  public.cash_movements,
  public.cash_registers,
  public.catalog_items,
  public.categories,
  public.company_settings,
  public.customers,
  public.files,
  public.materials,
  public.order_items,
  public.orders,
  public.payments,
  public.profiles,
  public.quote_items,
  public.quotes,
  public.companies
  cascade;
