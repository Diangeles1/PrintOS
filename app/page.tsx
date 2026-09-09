import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

// A raiz não tem tela própria: manda para o lugar certo conforme a sessão.
// (A tela de login de verdade vive em /login.)
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const md = (user.user_metadata ?? {}) as Record<string, unknown>;
  const temNome = typeof md.display_name === 'string' && md.display_name.trim().length > 0;
  redirect(temNome ? '/dashboard' : '/boas-vindas');
}
