import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas que qualquer pessoa pode acessar sem estar logada.
// Adicionei "/" porque sua página inicial (Abrir sistema / Testar venda
// rápida) parece ser pensada pra ser pública. Se não for o caso, é só
// remover "/" desta lista.
const ROTAS_PUBLICAS = ["/login", "/", "/redefinir-senha", "/auth"];

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

  // Só o display_name conta: é o nome que o próprio usuário confirma na
  // tela de boas-vindas. Assim a pergunta aparece uma única vez, mesmo
  // pra quem já veio com nome do cadastro ou do Google/Microsoft.
  const metadados = (usuarioLogado?.user_metadata ?? {}) as Record<string, unknown>;
  const temNome =
    typeof metadados.display_name === "string" && metadados.display_name.trim().length > 0;

  const rotaAtual = request.nextUrl.pathname;
  const ehRotaPublica = ROTAS_PUBLICAS.some((rota) =>
    rota === "/" ? rotaAtual === "/" : rotaAtual.startsWith(rota)
  );
  const ehBoasVindas = rotaAtual === "/boas-vindas";

  const redirecionar = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return NextResponse.redirect(url);
  };

  // Sem sessão válida, tentando acessar rota protegida → manda pro login.
  if (!usuarioLogado && !ehRotaPublica) {
    return redirecionar("/login");
  }

  // Logado mas ainda sem nome → pergunta uma vez, na tela de boas-vindas.
  if (usuarioLogado && !temNome && !ehBoasVindas && !ehRotaPublica) {
    return redirecionar("/boas-vindas");
  }

  // Já tem nome e caiu em /boas-vindas → segue pro sistema.
  if (usuarioLogado && temNome && ehBoasVindas) {
    return redirecionar("/dashboard");
  }

  // Já logado, tentando acessar a tela de login → manda pra frente.
  if (usuarioLogado && rotaAtual === "/login") {
    return redirecionar(temNome ? "/dashboard" : "/boas-vindas");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
