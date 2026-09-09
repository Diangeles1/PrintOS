import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type Papel = 'dono' | 'funcionario';

/** Papel do usuário logado na gráfica atual. Default 'dono' (compatível com contas antigas). */
export async function getPapel(): Promise<Papel> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('sou_dono');
  return data === false ? 'funcionario' : 'dono';
}

/** Barra funcionário: usa no topo das páginas que são só do dono. */
export async function requireDono() {
  if ((await getPapel()) === 'funcionario') redirect('/venda-rapida');
}
