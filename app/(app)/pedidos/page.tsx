import { createClient } from '@/lib/supabase/server';
import { requireDono } from '@/lib/equipe';

import PedidosList, { type PedidoLista } from './PedidosList';

export default async function PedidosPage() {
  await requireDono();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero, cliente_nome, status, prazo, total, origem, created_at, pedido_itens(count)',
    )
    .order('created_at', { ascending: false });

  return (
    <PedidosList
      initial={(data as unknown as PedidoLista[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
