import { createClient } from '@/lib/supabase/server';
import { getPapel } from '@/lib/equipe';

import VendaRapida, { type ServicoVenda } from './VendaRapida';

function inicioDeHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function VendaRapidaPage() {
  const supabase = await createClient();
  const papel = await getPapel();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: servicos, error }, { data: caixa }, { data: minhas }] = await Promise.all([
    supabase
      .from('servicos')
      .select('id, nome, categoria, preco, unidade')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true }),
    supabase.from('caixa_sessoes').select('id').eq('status', 'aberto').limit(1),
    supabase
      .from('pedidos')
      .select('total')
      .eq('criado_por', user?.id ?? '')
      .eq('status', 'entregue')
      .gte('created_at', inicioDeHoje()),
  ]);

  const meuTotalHoje = (minhas ?? []).reduce(
    (acc, p) => acc + Number((p as { total: number }).total || 0),
    0,
  );

  return (
    <VendaRapida
      servicos={(servicos as ServicoVenda[] | null) ?? []}
      caixaAberto={Boolean(caixa && caixa.length > 0)}
      erroCarregar={error ? error.message : null}
      papel={papel}
      meuTotalHoje={meuTotalHoje}
      meuQtdHoje={(minhas ?? []).length}
    />
  );
}
