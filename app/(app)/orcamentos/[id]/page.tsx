import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import OrcamentoEditor, {
  type ClienteOpc,
  type ItemOrc,
  type Orcamento,
  type ServicoOpc,
} from './OrcamentoEditor';

export default async function OrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: orcamento }, { data: itens }, { data: clientes }, { data: servicos }] =
    await Promise.all([
      supabase.from('orcamentos').select('*').eq('id', id).maybeSingle(),
      supabase.from('orcamento_itens').select('*').eq('orcamento_id', id).order('ordem'),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase
        .from('servicos')
        .select('id, nome, preco, unidade')
        .eq('ativo', true)
        .order('nome'),
    ]);

  if (!orcamento) notFound();

  return (
    <OrcamentoEditor
      orcamento={orcamento as Orcamento}
      itens={(itens as ItemOrc[] | null) ?? []}
      clientes={(clientes as ClienteOpc[] | null) ?? []}
      servicos={(servicos as ServicoOpc[] | null) ?? []}
    />
  );
}
