import { createClient } from '@/lib/supabase/server';

import ClientesView, { type Cliente } from './ClientesView';

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  return (
    <ClientesView
      initial={(data as Cliente[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
