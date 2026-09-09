import { createClient } from '@/lib/supabase/server';
import { requireDono } from '@/lib/equipe';

import CaixaView, { type Movimento, type Sessao } from './CaixaView';

export default async function CaixaPage() {
  await requireDono();
  const supabase = await createClient();

  const { data: abertaRows, error } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('status', 'aberto')
    .order('aberto_em', { ascending: false })
    .limit(1);

  const sessao = (abertaRows?.[0] as Sessao | undefined) ?? null;

  let movimentos: Movimento[] = [];
  if (sessao) {
    const { data } = await supabase
      .from('caixa_movimentos')
      .select('*')
      .eq('sessao_id', sessao.id)
      .order('created_at', { ascending: true });
    movimentos = (data as Movimento[] | null) ?? [];
  }

  const { data: fechadas } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('status', 'fechado')
    .order('aberto_em', { ascending: false })
    .limit(8);

  return (
    <CaixaView
      sessao={sessao}
      movimentos={movimentos}
      historico={(fechadas as Sessao[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
