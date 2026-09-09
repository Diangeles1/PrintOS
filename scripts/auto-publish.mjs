#!/usr/bin/env node
// PrintOS Auto Publisher
// ----------------------
// Mantém o projeto sempre atualizado no GitHub, em ciclo contínuo:
//   1. commita o que estiver pendente na árvore de trabalho
//   2. sincroniza com o remoto (git rebase em cima de origin/<branch>)
//   3. checa o CI — se o último run em <branch> falhou, PAUSA o push
//   4. dá push
//
// Node puro, sem dependência nova. Roda no Windows, macOS e Linux.
//
// Uso:
//   node scripts/auto-publish.mjs                 loop infinito (padrão 300s)
//   node scripts/auto-publish.mjs --once          um ciclo só e sai
//   node scripts/auto-publish.mjs --dry-run       mostra o que faria, sem commit/push
//   node scripts/auto-publish.mjs --interval=120  intervalo em segundos
//   node scripts/auto-publish.mjs --branch=main   branch alvo
//   node scripts/auto-publish.mjs --no-ci-gate    ignora o status do CI
//
// Variáveis de ambiente (equivalentes às flags, todas opcionais):
//   AUTOPUBLISH_INTERVAL_SEC   intervalo entre ciclos (padrão 300)
//   AUTOPUBLISH_BRANCH         branch alvo (padrão: a branch atual)
//   AUTOPUBLISH_REMOTE         remote (padrão "origin")
//   AUTOPUBLISH_MESSAGE        prefixo da mensagem de commit
//   AUTOPUBLISH_CI_GATE        "0" desliga a trava de CI
//   AUTOPUBLISH_CI_WORKFLOW    nome do workflow a checar (padrão "CI")
//   AUTOPUBLISH_LOG            caminho do arquivo de log

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFile, mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WIN = process.platform === "win32";

// ---------------------------------------------------------------- argumentos ---
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
const opts = Object.fromEntries(
  argv
    .filter((a) => a.startsWith("--") && a.includes("="))
    .map((a) => {
      const eq = a.indexOf("=");
      return [a.slice(2, eq), a.slice(eq + 1)];
    }),
);

if (flags.has("--help") || flags.has("-h")) {
  console.log(
    [
      "PrintOS Auto Publisher — commita, sincroniza e dá push do projeto no GitHub em ciclo.",
      "",
      "  node scripts/auto-publish.mjs                 loop infinito (padrão 300s)",
      "  node scripts/auto-publish.mjs --once          um ciclo só e sai",
      "  node scripts/auto-publish.mjs --dry-run       simula, sem commit/push",
      "  node scripts/auto-publish.mjs --interval=120  segundos entre ciclos",
      "  node scripts/auto-publish.mjs --branch=main   branch alvo",
      "  node scripts/auto-publish.mjs --no-ci-gate    ignora o status do CI",
      "",
      "Env: AUTOPUBLISH_INTERVAL_SEC, AUTOPUBLISH_BRANCH, AUTOPUBLISH_REMOTE,",
      "     AUTOPUBLISH_MESSAGE, AUTOPUBLISH_CI_GATE=0, AUTOPUBLISH_CI_WORKFLOW, AUTOPUBLISH_LOG",
    ].join("\n"),
  );
  process.exit(0);
}

const ONCE = flags.has("--once");
const DRY = flags.has("--dry-run") || flags.has("--dry");

const CFG = {
  intervalSec: clampInt(
    opts.interval ?? process.env.AUTOPUBLISH_INTERVAL_SEC ?? 300,
    15,
    86400,
    300,
  ),
  remote: opts.remote || process.env.AUTOPUBLISH_REMOTE || "origin",
  branch: opts.branch || process.env.AUTOPUBLISH_BRANCH || "",
  msgPrefix:
    opts.message ||
    process.env.AUTOPUBLISH_MESSAGE ||
    "chore(auto): publica alterações do PrintOS",
  ciGate:
    !flags.has("--no-ci-gate") &&
    opts["ci-gate"] !== "0" &&
    process.env.AUTOPUBLISH_CI_GATE !== "0",
  ciWorkflow:
    opts["ci-workflow"] || process.env.AUTOPUBLISH_CI_WORKFLOW || "CI",
  log:
    opts.log ||
    process.env.AUTOPUBLISH_LOG ||
    path.join(ROOT, "scripts", ".auto-publish.log"),
};

// ------------------------------------------------------------------- helpers ---
function clampInt(v, min, max, dflt) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

async function run(cmd, args, extra = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 32,
      windowsHide: true,
      ...extra,
    });
    return { code: 0, stdout: String(stdout), stderr: String(stderr) };
  } catch (err) {
    return {
      code: err.code ?? 1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? err.message ?? ""),
    };
  }
}

const git = (...args) => run("git", args);

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

async function log(level, msg) {
  const line = `[${ts()}] ${level.padEnd(5)} ${msg}`;
  (level === "ERROR" || level === "WARN" ? process.stderr : process.stdout).write(
    line + "\n",
  );
  try {
    await appendFile(CFG.log, line + "\n");
  } catch {
    /* log em disco é best-effort */
  }
}
const info = (m) => log("INFO", m);
const warn = (m) => log("WARN", m);
const err = (m) => log("ERROR", m);

function sleep(ms, shouldStop) {
  return new Promise((res) => {
    let waited = 0;
    const step = 500;
    const t = setInterval(() => {
      waited += step;
      if (waited >= ms || (shouldStop && shouldStop())) {
        clearInterval(t);
        res();
      }
    }, step);
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // existe, mas sem permissão de sinalizar
  }
}

// --------------------------------------------------------------------- lock ---
async function acquireLock(gitDir) {
  const lockPath = path.join(gitDir, "printos-auto-publish.lock");
  if (existsSync(lockPath)) {
    const raw = (await readFile(lockPath, "utf8").catch(() => "")).trim();
    const owner = Number(raw);
    if (owner && owner !== process.pid && pidAlive(owner)) {
      throw new Error(
        `outra instância já está rodando (PID ${owner}). Lock: ${lockPath}`,
      );
    }
    await warn(`lock órfão (PID ${raw || "?"}) — assumindo`);
  }
  await writeFile(lockPath, String(process.pid));
  return lockPath;
}

// ------------------------------------------------------------------ CI gate ---
// Duas vias: o GitHub CLI (`gh`, respeita seu login e cobre repo privado) e,
// se ele não existir, a API REST pública do GitHub via fetch (repo público,
// ou com token em GITHUB_TOKEN / GH_TOKEN). Qualquer falha das duas → não
// bloqueia (a trava só PAUSA em falha confirmada do CI, nunca por dúvida).
let ciWarned = false;
let ghViaShell = false;
let ghMissing = false;

const BAD_CONCLUSIONS = [
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required",
];

function classifyRun(status, conclusion, url) {
  if (status !== "completed") {
    return { ok: true, state: `em andamento (${status})`, url };
  }
  if (BAD_CONCLUSIONS.includes(conclusion)) {
    return { ok: false, state: conclusion, url };
  }
  return { ok: true, state: conclusion || "success", url };
}

async function ghRun(args) {
  let r = await run("gh", args, ghViaShell ? { shell: true } : {});
  if (
    !ghViaShell &&
    IS_WIN &&
    r.code !== 0 &&
    /EINVAL|is not recognized|ENOENT|spawn/i.test(r.stderr)
  ) {
    // gh pode ser um shim .cmd (scoop/winget) — Node 22 bloqueia .cmd sem shell
    ghViaShell = true;
    r = await run("gh", args, { shell: true });
  }
  return r;
}

async function checkCiViaGh(branch) {
  if (ghMissing) return null;
  const probe = await ghRun(["--version"]);
  if (probe.code !== 0) {
    ghMissing = true;
    return null;
  }
  const r = await ghRun([
    "run",
    "list",
    "--workflow",
    CFG.ciWorkflow,
    "--branch",
    branch,
    "--limit",
    "1",
    "--json",
    "status,conclusion,url",
  ]);
  if (r.code !== 0) return null;
  let runs;
  try {
    runs = JSON.parse(r.stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(runs) || runs.length === 0) {
    return { ok: true, state: "sem runs" };
  }
  return classifyRun(runs[0].status, runs[0].conclusion, runs[0].url);
}

function repoSlugFromUrl(url) {
  const m = url
    .trim()
    .replace(/\.git$/, "")
    .match(/github\.com[/:]([^/]+\/[^/]+)$/i);
  return m ? m[1] : null;
}

async function checkCiViaApi(branch) {
  const remoteUrl = (
    await git("remote", "get-url", CFG.remote)
  ).stdout.trim();
  const slug = repoSlugFromUrl(remoteUrl);
  if (!slug) return null;

  const token =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GH_PAT || "";
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "printos-auto-publish" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const wf = encodeURIComponent(CFG.ciWorkflow);
  const qs = `branch=${encodeURIComponent(branch)}&per_page=1&exclude_pull_requests=true`;
  // tenta filtrar pelo nome do workflow; se não achar, cai pro geral
  const urls = [
    `https://api.github.com/repos/${slug}/actions/workflows/${wf}.yml/runs?${qs}`,
    `https://api.github.com/repos/${slug}/actions/runs?${qs}`,
  ];
  for (const u of urls) {
    let res;
    try {
      res = await fetch(u, { headers });
    } catch {
      return null;
    }
    if (res.status === 404) continue;
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const runs = body && body.workflow_runs;
    if (!Array.isArray(runs)) return null;
    const pick =
      runs.find((r) => (r.name || "").toLowerCase() === CFG.ciWorkflow.toLowerCase()) ||
      runs[0];
    if (!pick) return { ok: true, state: "sem runs" };
    return classifyRun(pick.status, pick.conclusion, pick.html_url);
  }
  return { ok: true, state: "sem runs" };
}

async function checkCi(branch) {
  const viaGh = await checkCiViaGh(branch);
  if (viaGh) return viaGh;
  const viaApi = await checkCiViaApi(branch);
  if (viaApi) return viaApi;
  if (!ciWarned) {
    await warn(
      "não deu pra checar o CI (sem `gh` e sem acesso à API do GitHub) — trava de CI ignorada. Instale o GitHub CLI (winget install GitHub.cli) + `gh auth login`, ou defina GITHUB_TOKEN.",
    );
    ciWarned = true;
  }
  return { ok: true, state: "indisponível" };
}

// -------------------------------------------------------------------- ciclo ---
async function cycle() {
  const cur = (await git("rev-parse", "--abbrev-ref", "HEAD")).stdout.trim();
  if (!cur || cur === "HEAD") {
    await warn("HEAD destacado (sem branch) — pulando ciclo");
    return;
  }
  const branch = CFG.branch || cur;
  if (cur !== branch) {
    await warn(`branch atual "${cur}" ≠ alvo "${branch}" — pulando ciclo`);
    return;
  }

  const remotes = (await git("remote")).stdout.split(/\s+/).filter(Boolean);
  if (!remotes.includes(CFG.remote)) {
    await err(`remote "${CFG.remote}" não existe (remotes: ${remotes.join(", ") || "nenhum"})`);
    return;
  }

  // 1. commita o pendente ------------------------------------------------------
  const dirty = (await git("status", "--porcelain")).stdout.trim();
  if (dirty) {
    const n = dirty.split("\n").length;
    if (DRY) {
      await info(`[dry-run] commitaria ${n} arquivo(s)`);
    } else {
      await git("add", "-A");
      const staged = (
        await git("diff", "--cached", "--name-only")
      ).stdout.trim();
      if (staged) {
        const files = staged.split("\n").length;
        const msg = `${CFG.msgPrefix} (${files} arquivo${files > 1 ? "s" : ""})\n\n${ts()} — auto-publish`;
        const c = await git("commit", "-m", msg);
        if (c.code !== 0) {
          await warn(
            `commit falhou: ${(c.stderr || c.stdout).trim().split("\n")[0]}`,
          );
        } else {
          await info(`commit criado — ${files} arquivo(s)`);
        }
      }
    }
  }

  // 2. sincroniza ------------------------------------------------------------
  const f = await git("fetch", CFG.remote, branch, "--quiet");
  if (f.code !== 0) {
    await warn(`fetch falhou: ${f.stderr.trim().split("\n")[0]}`);
    return;
  }

  const behind = (
    await git("rev-list", "--count", `HEAD..${CFG.remote}/${branch}`)
  ).stdout.trim();
  if (behind !== "0" && behind !== "") {
    await info(`${behind} commit(s) atrás de ${CFG.remote}/${branch} — rebase`);
    if (!DRY) {
      const rb = await git("rebase", `${CFG.remote}/${branch}`);
      if (rb.code !== 0) {
        await git("rebase", "--abort");
        await err(
          "rebase deu conflito — abortado. Resolva à mão (git status). Nada foi enviado.",
        );
        return;
      }
    }
  }

  // 3. tem o que enviar? ---------------------------------------------------
  const ahead = (
    await git("rev-list", "--count", `${CFG.remote}/${branch}..HEAD`)
  ).stdout.trim();
  if (ahead === "0" || ahead === "") {
    await info("nada novo pra enviar");
    return;
  }

  // 4. trava de CI ------------------------------------------------------
  if (CFG.ciGate) {
    const gate = await checkCi(branch);
    if (!gate.ok) {
      await warn(
        `CI "${gate.state}" — PUSH PAUSADO. ${ahead} commit(s) local(is) aguardando. Conserte o CI e o push volta sozinho. ${gate.url || ""}`,
      );
      return;
    }
    await info(`CI ok (${gate.state})`);
  }

  // 5. push -------------------------------------------------------------
  if (DRY) {
    await info(`[dry-run] daria push de ${ahead} commit(s) → ${CFG.remote}/${branch}`);
    return;
  }
  let p = await git("push", CFG.remote, `HEAD:${branch}`);
  if (
    p.code !== 0 &&
    /non-fast-forward|fetch first|rejected|behind/i.test(p.stderr)
  ) {
    await warn("push rejeitado (remoto andou) — rebase + retry");
    await git("fetch", CFG.remote, branch, "--quiet");
    const rb = await git("rebase", `${CFG.remote}/${branch}`);
    if (rb.code !== 0) {
      await git("rebase", "--abort");
      await err("rebase no retry deu conflito — abortado");
      return;
    }
    p = await git("push", CFG.remote, `HEAD:${branch}`);
  }
  if (p.code !== 0) {
    await err(`push falhou: ${p.stderr.trim().split("\n").slice(-1)[0]}`);
    return;
  }
  await info(`push OK — ${ahead} commit(s) → ${CFG.remote}/${branch}`);
}

// --------------------------------------------------------------------- main ---
async function main() {
  await mkdir(path.dirname(CFG.log), { recursive: true }).catch(() => {});

  const top = await git("rev-parse", "--show-toplevel");
  if (top.code !== 0) {
    await err("não é um repositório git — abortando");
    process.exit(1);
  }
  const gitDirRaw = (await git("rev-parse", "--git-dir")).stdout.trim();
  const gitDir = path.resolve(ROOT, gitDirRaw);

  let lockPath;
  try {
    lockPath = await acquireLock(gitDir);
  } catch (e) {
    await err(e.message);
    process.exit(1);
  }
  process.on("exit", () => {
    try {
      unlinkSync(lockPath);
    } catch {
      /* já foi */
    }
  });

  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      if (stopping) process.exit(130);
      stopping = true;
      warn(`${sig} recebido — encerrando após o ciclo atual (repita pra forçar)`);
    });
  }

  await info(
    `auto-publish ON — alvo ${CFG.branch || `(atual)`} @ ${CFG.remote}, ciclo ${CFG.intervalSec}s, CI gate ${CFG.ciGate ? "on" : "off"}${ONCE ? ", --once" : ""}${DRY ? ", --dry-run" : ""}`,
  );

  do {
    try {
      await cycle();
    } catch (e) {
      await err(`ciclo falhou: ${e.message}`);
    }
    if (ONCE || stopping) break;
    await sleep(CFG.intervalSec * 1000, () => stopping);
  } while (!stopping);

  try {
    await unlink(lockPath);
  } catch {
    /* ok */
  }
  await info("auto-publish OFF");
  process.exit(0);
}

main();
