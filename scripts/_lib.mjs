// Utilitários compartilhados pelos scripts de teste. Sem dependência nova:
// usa @supabase/supabase-js (já no projeto) + fetch/crypto nativos do Node 18+.
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ---- .env.local (parser simples) -------------------------------------------
function carregarEnv() {
  let txt = '';
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    try {
      txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    } catch {
      /* segue com process.env */
    }
  }
  for (const linha of txt.split('\n')) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i < 0) continue;
    const k = l.slice(0, i).trim();
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
carregarEnv();

export const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
// APP_URL sobrescreve NEXT_PUBLIC_APP_URL para os testes (ex.: apontar pro
// servidor de produção em :3100 em vez do dev em :3000).
export const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

if (!URL_SB || !ANON || !SERVICE) {
  console.error('Faltam variáveis em .env.local: NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// ---- clientes -------------------------------------------------------------
export function admin() {
  return createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cria um usuário de teste e devolve { id, email, senha, cli } já logado (RLS ativa). */
export async function novoUsuario(rotulo) {
  const a = admin();
  const email = `teste+${rotulo}-${Date.now()}-${randomBytes(3).toString('hex')}@printos.test`;
  const senha = 'Teste!' + randomBytes(6).toString('hex');
  const { data, error } = await a.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`createUser (${rotulo}): ${error.message}`);
  const id = data.user.id;

  const cli = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await cli.auth.signInWithPassword({ email, password: senha });
  if (e2) throw new Error(`signIn (${rotulo}): ${e2.message}`);
  return { id, email, senha, cli };
}

export async function apagarUsuario(id) {
  if (!id) return;
  try {
    await admin().auth.admin.deleteUser(id);
  } catch (e) {
    console.warn(`  (aviso) não consegui apagar usuário ${id}: ${e.message}`);
  }
}

export function tokenIngest() {
  const t = 'pit_' + randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(t).digest('hex');
  return { texto: t, hash };
}

export function tokenAprovacao() {
  return randomBytes(24).toString('hex'); // 48 hex, casa com ^[a-f0-9]{32,80}$
}

// ---- placar ------------------------------------------------------------------
export function criarPlacar(titulo) {
  let ok = 0;
  let falhou = 0;
  const falhas = [];
  console.log(`\n=== ${titulo} ===\n`);
  return {
    check(nome, cond, detalhe = '') {
      if (cond) {
        ok++;
        console.log(`  \x1b[32mPASS\x1b[0m  ${nome}`);
      } else {
        falhou++;
        falhas.push(nome + (detalhe ? ` — ${detalhe}` : ''));
        console.log(`  \x1b[31mFAIL\x1b[0m  ${nome}${detalhe ? `  (${detalhe})` : ''}`);
      }
    },
    fim() {
      console.log(`\n--- ${titulo}: ${ok} PASS, ${falhou} FAIL ---`);
      if (falhas.length) {
        console.log('\nFalhas:');
        for (const f of falhas) console.log('  • ' + f);
      }
      return falhou === 0;
    },
  };
}
