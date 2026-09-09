import { createClient } from '@/lib/supabase/server';

import OrcamentosList, { type OrcamentoLista } from './OrcamentosList';

export default async function OrcamentosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orcamentos')
    .select('id, numero, cliente_nome, status, validade, total, created_at, orcamento_itens(count)')
    .order('created_at', { ascending: false });

  return (
    <OrcamentosList
      initial={(data as unknown as OrcamentoLista[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
