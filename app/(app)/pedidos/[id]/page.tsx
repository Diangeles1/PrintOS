import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import PedidoEditor, {
  type ClienteOpc,
  type ItemPed,
  type Pedido,
  type ServicoOpc,
} from './PedidoEditor';

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pedido }, { data: itens }, { data: clientes }, { data: servicos }] =
    await Promise.all([
      supabase.from('pedidos').select('*').eq('id', id).maybeSingle(),
      supabase.from('pedido_itens').select('*').eq('pedido_id', id).order('ordem'),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase
        .from('servicos')
        .select('id, nome, preco, unidade')
        .eq('ativo', true)
        .order('nome'),
    ]);

  if (!pedido) notFound();

  return (
    <PedidoEditor
      pedido={pedido as Pedido}
      itens={(itens as ItemPed[] | null) ?? []}
      clientes={(clientes as ClienteOpc[] | null) ?? []}
      servicos={(servicos as ServicoOpc[] | null) ?? []}
    />
  );
}
