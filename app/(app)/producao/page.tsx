import { createClient } from '@/lib/supabase/server';

import ProducaoBoard, { type PedidoCard } from './ProducaoBoard';

export default async function ProducaoPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente_nome, status, prazo, total')
    .in('status', ['aguardando_arte', 'em_producao', 'pronto'])
    .order('prazo', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  return (
    <ProducaoBoard
      initial={(data as PedidoCard[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
