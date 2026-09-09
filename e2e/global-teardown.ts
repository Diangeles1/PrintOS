import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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

export default async function globalTeardown() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of lista.users) {
    if ((u.email || '').startsWith('e2e-') && (u.email || '').endsWith('@printos.test')) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}
