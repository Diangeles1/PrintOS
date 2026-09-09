import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

import { E2E } from './usuarios';

function env(k: string): string {
  if (process.env[k]) return process.env[k] as string;
  for (const f of ['.env.local', '.env']) {
    try {
      for (const l of readFileSync(f, 'utf8').split('\n')) {
        const i = l.indexOf('=');
        if (i > 0 && l.slice(0, i).trim() === k) return l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* próximo */
    }
  }
  return '';
}

export default async function globalSetup() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('E2E: faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // apaga sobras de execuções anteriores
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of lista.users) {
    if ((u.email || '').startsWith('e2e-') && (u.email || '').endsWith('@printos.test')) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  // cria os usuários do teste, já com display_name (pula a tela de boas-vindas)
  for (const u of [E2E.fluxo, E2E.admin, E2E.alvo]) {
    const { error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.senha,
      email_confirm: true,
      user_metadata: { display_name: u.nome },
    });
    if (error && !/already/i.test(error.message)) throw new Error(`E2E setup ${u.email}: ${error.message}`);
  }
}
