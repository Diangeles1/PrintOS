import { createClient } from '@/lib/supabase/server';
import { requireDono } from '@/lib/equipe';

import OrcamentosList, { type OrcamentoLista } from './OrcamentosList';

export default async function OrcamentosPage() {
  await requireDono();
  const supabase = await createClient();
  const [{ data, error }, { data: empresa }] = await Promise.all([
    supabase
      .from('orcamentos')
      .select(
        'id, numero, cliente_nome, status, validade, total, created_at, orcamento_itens(count)',
      )
      .order('created_at', { ascending: false }),
    supabase.from('empresa').select('orcamento_validade_dias, orcamento_condicoes').maybeSingle(),
  ]);

  return (
    <OrcamentosList
      initial={(data as unknown as OrcamentoLista[] | null) ?? []}
      erroCarregar={error ? error.message : null}
      validadeDias={empresa?.orcamento_validade_dias ?? 15}
      condicoesPadrao={empresa?.orcamento_condicoes ?? null}
    />
  );
}
