import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas que qualquer pessoa pode acessar sem estar logada.
// Adicionei "/" porque sua página inicial (Abrir sistema / Testar venda
// rápida) parece ser pensada pra ser pública. Se não for o caso, é só
// remover "/" desta lista.
const ROTAS_PUBLICAS = ["/login", "/", "/redefinir-senha"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() é o método que o próprio Supabase recomenda pra proteger
  // página: ele confere a ASSINATURA do token de verdade. getSession()
  // só lê o cookie sem confirmar se ele é legítimo — nunca use ele pra
  // decidir quem entra ou não.
  const { data } = await supabase.auth.getClaims();
  const usuarioLogado = data?.claims;

  const rotaAtual = request.nextUrl.pathname;
  const ehRotaPublica = ROTAS_PUBLICAS.some((rota) =>
    rota === "/" ? rotaAtual === "/" : rotaAtual.startsWith(rota)
  );

  // Sem sessão válida, tentando acessar rota protegida → manda pro login.
  if (!usuarioLogado && !ehRotaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Já logado, tentando acessar a tela de login → manda pro dashboard.
  if (usuarioLogado && rotaAtual === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
