import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Retorno do OAuth (Google / Microsoft) e de outros fluxos PKCE.
// O provedor redireciona pra cá com ?code=... — aqui a gente troca esse
// code por uma sessão e grava os cookies antes de mandar o usuário pra
// dentro do sistema.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const erroProvedor = searchParams.get("error_description") ?? searchParams.get("error");

  // Só aceita caminho relativo do próprio app, pra evitar open redirect.
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const destino = (path: string) => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const base =
      process.env.NODE_ENV === "development" || !forwardedHost
        ? origin
        : `https://${forwardedHost}`;
    return NextResponse.redirect(`${base}${path}`);
  };

  if (erroProvedor) {
    return destino(`/login?erro=oauth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return destino(next);
    }
  }

  return destino(`/login?erro=oauth`);
}
