// Captura screenshots reais do PrintOS para o README.
// ---------------------------------------------------------------------------
// - assume o servidor já no ar (dev :3000 por padrão; troque com SHOTS_BASE_URL)
// - cria/atualiza uma conta de demonstração @printos.test com SENHA ALEATÓRIA
//   descartável (nunca gravada em disco nem no repositório)
// - semeia dados fictícios uma vez (clientes/serviços/pedidos/orçamentos…)
// - navega logado com o Playwright (chromium já instalado pelo projeto)
// - salva PNGs em docs/screenshots/
//
//   node scripts/capture-readme-screenshots.mjs            # captura tudo
//   node scripts/capture-readme-screenshots.mjs --reseed   # limpa e semeia de novo
//   SHOTS_BASE_URL=http://localhost:3100 node scripts/capture-readme-screenshots.mjs
//
// Requisitos: .env.local com NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY /
// SUPABASE_SERVICE_ROLE_KEY (os mesmos que o dev server usa).

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium, devices } from "@playwright/test";

import { admin } from "./_lib.mjs";

const BASE = (process.env.SHOTS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(process.cwd(), "docs/screenshots");
const EMAIL = process.env.DEMO_EMAIL || "demo@printos.test";
const NOME = "Ana Souza";
const EMPRESA = "Gráfica Modelo";
const RESEED = process.argv.includes("--reseed");

const a = admin();

// --- 1. conta de demonstração (senha aleatória, só vive neste processo) ------
const senha = "Px-" + randomBytes(15).toString("base64url") + "-9A";

async function acharUsuario(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

let user = await acharUsuario(EMAIL);
const meta = { display_name: NOME, full_name: NOME, company_name: EMPRESA };
if (!user) {
  const { data, error } = await a.auth.admin.createUser({
    email: EMAIL,
    password: senha,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  user = data.user;
  console.log(`+ conta de demo criada: ${EMAIL}`);
} else {
  const { error } = await a.auth.admin.updateUserById(user.id, {
    password: senha,
    user_metadata: meta,
  });
  if (error) throw new Error(`updateUser: ${error.message}`);
  console.log(`· conta de demo reutilizada: ${EMAIL}`);
}
const userId = user.id;

// --- 2. dados fictícios (semeia só se estiver vazio, ou com --reseed) --------
if (RESEED) {
  console.log("· --reseed: limpando dados de negócio da conta de demo…");
  const tabelas = [
    "caixa_movimentos", "caixa_sessoes",
    "pedido_arquivos", "pedido_aprovacoes", "pedido_itens", "pedidos",
    "orcamento_itens", "orcamentos",
    "whatsapp_pendentes", "whatsapp_numeros", "ingest_tokens",
    "servicos", "materiais", "clientes", "empresa",
  ];
  for (const t of tabelas) {
    await a.from(t).delete().eq("user_id", userId);
  }
}
const { count } = await a
  .from("clientes")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId);

if (!count || RESEED) {
  console.log("· semeando dados de demonstração…");
  execFileSync("node", ["scripts/seed-demo.mjs", EMAIL], { stdio: "inherit" });
} else {
  console.log(`· já havia ${count} clientes — pulando o seed (use --reseed pra refazer)`);
}

// identidade da empresa (deixa Configurações / doc de impressão / aprovação cheios)
await a.from("empresa").upsert(
  {
    user_id: userId,
    nome: EMPRESA,
    documento: "12.345.678/0001-90",
    telefone: "(79) 3221-0000",
    endereco: "Av. Central, 1200 — Centro, Aracaju/SE",
    orcamento_validade_dias: 15,
    orcamento_condicoes:
      "Prazo de 5 dias úteis após a aprovação da arte. Pagamento: 50% na aprovação e 50% na retirada.",
  },
  { onConflict: "user_id" },
);

// ids úteis pras telas de detalhe
const { data: pedidoDet } = await a
  .from("pedidos")
  .select("id")
  .eq("user_id", userId)
  .in("status", ["em_producao", "aguardando_arte"])
  .limit(1)
  .maybeSingle();
const { data: orcamentoDet } = await a
  .from("orcamentos")
  .select("id")
  .eq("user_id", userId)
  .limit(1)
  .maybeSingle();

// link público de aprovação de arte + uma "arte" de exemplo anexada ao pedido
let tokenAprov = null;
let artePath = null;
if (pedidoDet?.id) {
  tokenAprov = randomBytes(24).toString("hex"); // 48 hex → casa com ^[a-f0-9]{32,80}$
  const { error } = await a.from("pedido_aprovacoes").insert({
    pedido_id: pedidoDet.id,
    user_id: userId,
    token: tokenAprov,
    status: "pendente",
  });
  if (error) {
    console.warn(`  (aviso) não criei o link de aprovação: ${error.message}`);
    tokenAprov = null;
  }

  try {
    const buf = readFileSync(path.resolve(process.cwd(), "public/printos-mascote.png"));
    artePath = `${userId}/${pedidoDet.id}/arte-demo.png`;
    await a.storage.from("pedido-arquivos").upload(artePath, buf, {
      contentType: "image/png",
      upsert: true,
    });
    await a.from("pedido_arquivos").delete().eq("pedido_id", pedidoDet.id).eq("path", artePath);
    await a.from("pedido_arquivos").insert({
      pedido_id: pedidoDet.id,
      user_id: userId,
      path: artePath,
      nome: "arte-aprovacao.png",
      mime: "image/png",
      tamanho: buf.length,
    });
  } catch (e) {
    console.warn(`  (aviso) não anexei a arte de exemplo: ${e.message}`);
    artePath = null;
  }
}

// --- 3. Playwright ----------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function novaAba(extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "pt-BR",
    ...extra,
  });
  // esconde o indicador de dev do Next.js (badge "N" flutuante) nas capturas
  await ctx.addInitScript(() => {
    const css =
      "nextjs-portal,[data-next-badge-root],[data-next-badge],[data-nextjs-toast]," +
      "[data-nextjs-dev-indicator],#__next-dev-tools-indicator,#__next-build-watcher," +
      "[data-next-mark]{display:none!important}";
    const put = () => {
      if (!document.head) return requestAnimationFrame(put);
      const s = document.createElement("style");
      s.textContent = css;
      document.head.appendChild(s);
    };
    put();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  return { ctx, page };
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("seu@e-mail.com").fill(EMAIL);
  await page.getByPlaceholder("Digite sua senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(dashboard|venda-rapida|boas-vindas)/, { timeout: 30_000 });
  if (page.url().includes("/boas-vindas")) {
    await page.getByRole("textbox").first().fill(NOME);
    await page.getByRole("button", { name: /Continuar|Entrar|Começar/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }
}

const feitas = [];
async function shot(page, name, url, opts = {}) {
  if (url) await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  if (opts.scrollTo) {
    await page.getByText(opts.scrollTo, { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
  }
  await page.waitForTimeout(opts.wait ?? 1000);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.full, animations: "disabled" });
  feitas.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
  console.log(`  ✓ ${name}.png${opts.full ? " (página inteira)" : ""}`);
}

try {
  // ---- deslogado ----
  {
    const { ctx, page } = await novaAba();
    await shot(page, "login", "/login", { wait: 1400 });
    await ctx.close();
  }
  // ---- mobile (deslogado + logado) ----
  {
    const { ctx, page } = await novaAba({ ...devices["iPhone 13"], colorScheme: "light" });
    await shot(page, "login-mobile", "/login", { wait: 1400 });
    await login(page);
    await shot(page, "dashboard-mobile", "/dashboard", { wait: 1200 });
    await ctx.close();
  }
  // ---- logado (desktop) ----
  {
    const { ctx, page } = await novaAba();
    await login(page);

    await shot(page, "dashboard", "/dashboard", { wait: 1200 });
    await shot(page, "pedidos", "/pedidos", { wait: 1200 });
    if (pedidoDet?.id) await shot(page, "pedido", `/pedidos/${pedidoDet.id}`, { wait: 1200 });
    await shot(page, "producao", "/producao", { wait: 1400 });
    await shot(page, "orcamentos", "/orcamentos", { wait: 1200 });
    if (orcamentoDet?.id)
      await shot(page, "orcamento-imprimir", `/orcamentos/${orcamentoDet.id}/imprimir`, { wait: 1600 });
    await shot(page, "venda-rapida", "/venda-rapida", { wait: 1400 });
    await shot(page, "caixa", "/caixa", { wait: 1200 });
    await shot(page, "clientes", "/clientes", { wait: 1200 });
    await shot(page, "servicos", "/servicos", { wait: 1200 });
    await shot(page, "materiais", "/materiais", { wait: 1200 });
    await shot(page, "configuracoes", "/configuracoes", { full: true, wait: 1400 });
    await shot(page, "configuracoes-whatsapp", "/configuracoes", {
      scrollTo: "Pedidos pelo WhatsApp",
      wait: 1200,
    });
    await ctx.close();
  }
  // ---- página pública de aprovação de arte ----
  if (tokenAprov) {
    const { ctx, page } = await novaAba();
    await shot(page, "aprovacao", `/aprovar/${tokenAprov}`, { wait: 1400 });
    await ctx.close();
  }
} finally {
  await browser.close();
  // limpa os artefatos de teste (link público + arte de exemplo)
  if (tokenAprov) {
    await a.from("pedido_aprovacoes").delete().eq("token", tokenAprov);
  }
  if (artePath) {
    await a.from("pedido_arquivos").delete().eq("path", artePath);
    await a.storage.from("pedido-arquivos").remove([artePath]);
  }
}

console.log(`\n${feitas.length} screenshot(s) em ${path.relative(process.cwd(), OUT).replace(/\\/g, "/")}/`);
for (const f of feitas) console.log("  " + f);
