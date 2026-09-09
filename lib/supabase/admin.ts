import { createClient } from "@supabase/supabase-js";

// Cliente com service_role — ignora RLS. Usar SÓ no servidor, em rotas que
// já autenticaram a origem por outro meio (ex.: assinatura do webhook da Meta).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL ausentes.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
