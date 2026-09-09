import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import PedidoEditor, {
  type Aprovacao,
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

  const [
    { data: pedido },
    { data: itens },
    { data: clientes },
    { data: servicos },
    { data: arqs },
    { data: aprov },
  ] = await Promise.all([
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
    supabase
      .from('pedido_aprovacoes')
      .select(
        'id, token, status, comentario, respondente, respondido_em, revogado, expira_em, created_at',
      )
      .eq('pedido_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  return (
    <PedidoEditor
      pedido={pedido as Pedido}
      itens={(itens as ItemPed[] | null) ?? []}
      clientes={(clientes as ClienteOpc[] | null) ?? []}
      servicos={(servicos as ServicoOpc[] | null) ?? []}
      arquivos={arquivos}
      aprovacao={(aprov as Aprovacao | null) ?? null}
      appUrl={appUrl}
    />
  );
}
