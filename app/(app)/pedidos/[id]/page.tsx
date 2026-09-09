import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import PedidoEditor, {
  type Arquivo,
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

  const [{ data: pedido }, { data: itens }, { data: clientes }, { data: servicos }, { data: arqs }] =
    await Promise.all([
      supabase.from('pedidos').select('*').eq('id', id).maybeSingle(),
      supabase.from('pedido_itens').select('*').eq('pedido_id', id).order('ordem'),
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase
        .from('servicos')
        .select('id, nome, preco, unidade')
        .eq('ativo', true)
        .order('nome'),
      supabase
        .from('pedido_arquivos')
        .select('id, path, nome, mime')
        .eq('pedido_id', id)
        .order('created_at'),
    ]);

  if (!pedido) notFound();

  const arquivos: Arquivo[] = [];
  for (const a of (arqs as { id: string; path: string; nome: string | null; mime: string | null }[] | null) ??
    []) {
    const { data: signed } = await supabase.storage
      .from('pedido-arquivos')
      .createSignedUrl(a.path, 3600);
    arquivos.push({
      id: a.id,
      nome: a.nome ?? 'arquivo',
      mime: a.mime ?? '',
      url: signed?.signedUrl ?? null,
    });
  }

  return (
    <PedidoEditor
      pedido={pedido as Pedido}
      itens={(itens as ItemPed[] | null) ?? []}
      clientes={(clientes as ClienteOpc[] | null) ?? []}
      servicos={(servicos as ServicoOpc[] | null) ?? []}
      arquivos={arquivos}
    />
  );
}
