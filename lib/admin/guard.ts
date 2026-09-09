import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Lista de e-mails autorizados (env SUPERADMIN_EMAILS, separados por vírgula). */
export function superadminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function ehSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lista = superadminEmails();
  return lista.length > 0 && lista.includes(email.toLowerCase());
}

/**
 * Verifica a sessão atual (server) e devolve o e-mail se for SuperADMIN.
 * Não redireciona — use em route handlers.
 */
export async function getSuperadmin(): Promise<{ email: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ehSuperadminEmail(user.email)) return null;
  return { email: user.email };
}

/** Igual ao acima, mas manda pro /dashboard se não for. Use em páginas server. */
export async function requireSuperadmin(): Promise<{ email: string }> {
  const sa = await getSuperadmin();
  if (!sa) redirect('/dashboard');
  return sa;
}
