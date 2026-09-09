import { createClient } from '@/lib/supabase/server';

import ServicosView, { type Servico } from './ServicosView';

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .order('ativo', { ascending: false })
    .order('nome', { ascending: true });

  return (
    <ServicosView
      initial={(data as Servico[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
