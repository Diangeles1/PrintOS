import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas que qualquer pessoa pode acessar sem estar logada.
// "/" só faz um redirect (ver app/page.tsx): sessão manda pro dashboard,
// sem sessão manda pro login.
const ROTAS_PUBLICAS = [
  "/login",
  "/",
  "/redefinir-senha",
  "/auth",
  "/api/whatsapp",
  "/api/ingest",
  "/aprovar",
  "/api/aprovacao",
];

// SuperADMIN: allowlist de e-mail (env). Inline aqui para não puxar
// next/headers pro middleware.
function ehSuperadmin(email: unknown): boolean {
  if (typeof email !== "string" || !email) return false;
  const lista = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.length > 0 && lista.includes(email.toLowerCase());
}

const DEV = process.env.NODE_ENV !== "production";
const SUPA_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

// Content-Security-Policy. `unsafe-inline` em script/style é o pragmático com
// Next (scripts de bootstrap/hidratação inline). `unsafe-eval` só em dev (HMR).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + SUPA_ORIGIN,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPA_ORIGIN} ${SUPA_ORIGIN.replace("https:", "wss:")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Cabeçalhos de segurança aplicados a toda resposta do app.
function comSeguranca(res: NextResponse, request?: NextRequest) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  res.headers.set("Content-Security-Policy", CSP);
  const https =
    request?.headers.get("x-forwarded-proto") === "https" ||
    request?.nextUrl.protocol === "https:";
  if (https) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  return res;
}

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
  const funcionario = metadados.papel === "funcionario";
  const inicio = funcionario ? "/venda-rapida" : "/dashboard";

  // telas só do dono (a RLS já protege os dados; aqui é pra não mostrar
  // página quebrada ao funcionário).
  const SO_DONO = ["/dashboard", "/orcamentos", "/pedidos", "/producao", "/caixa", "/configuracoes"];

  const rotaAtual = request.nextUrl.pathname;
  const ehRotaPublica = ROTAS_PUBLICAS.some((rota) =>
    rota === "/" ? rotaAtual === "/" : rotaAtual.startsWith(rota)
  );
  const ehBoasVindas = rotaAtual === "/boas-vindas";

  const redirecionar = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return comSeguranca(NextResponse.redirect(url), request);
  };

  // Sem sessão válida, tentando acessar rota protegida → manda pro login.
  if (!usuarioLogado && !ehRotaPublica) {
    return redirecionar("/login");
  }

  // /admin e /api/admin: só SuperADMIN (allowlist de e-mail). 1ª barreira;
  // as páginas/handlers re-verificam no servidor.
  if (rotaAtual.startsWith("/admin") || rotaAtual.startsWith("/api/admin")) {
    if (!ehSuperadmin(usuarioLogado?.email)) return redirecionar("/dashboard");
    return comSeguranca(response, request);
  }

  // Logado mas ainda sem nome → pergunta uma vez, na tela de boas-vindas.
  if (usuarioLogado && !temNome && !ehBoasVindas && !ehRotaPublica) {
    return redirecionar("/boas-vindas");
  }

  // Já tem nome e caiu em /boas-vindas → segue pro sistema.
  if (usuarioLogado && temNome && ehBoasVindas) {
    return redirecionar(inicio);
  }

  // Funcionário tentando abrir tela de dono → manda pra Venda Rápida.
  if (
    usuarioLogado &&
    temNome &&
    funcionario &&
    SO_DONO.some((p) => rotaAtual === p || rotaAtual.startsWith(`${p}/`))
  ) {
    return redirecionar("/venda-rapida");
  }

  // Já logado, na tela de login ou na raiz → manda pra frente (sem
  // renderizar a página só pra redirecionar de novo).
  if (usuarioLogado && (rotaAtual === "/login" || rotaAtual === "/")) {
    return redirecionar(temNome ? inicio : "/boas-vindas");
  }

  return comSeguranca(response, request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
