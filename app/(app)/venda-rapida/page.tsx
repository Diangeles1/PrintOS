import { createClient } from '@/lib/supabase/server';

import VendaRapida, { type ServicoVenda } from './VendaRapida';

export default async function VendaRapidaPage() {
  const supabase = await createClient();

  const [{ data: servicos, error }, { data: caixa }] = await Promise.all([
    supabase
      .from('servicos')
      .select('id, nome, categoria, preco, unidade')
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true }),
    supabase.from('caixa_sessoes').select('id').eq('status', 'aberto').limit(1),
  ]);

  return (
    <VendaRapida
      servicos={(servicos as ServicoVenda[] | null) ?? []}
      caixaAberto={Boolean(caixa && caixa.length > 0)}
      erroCarregar={error ? error.message : null}
    />
  );
}
