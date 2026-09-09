import { createClient } from '@/lib/supabase/server';

import MateriaisView, { type Material } from './MateriaisView';

export default async function MateriaisPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('materiais')
    .select('*')
    .order('nome', { ascending: true });

  return (
    <MateriaisView
      initial={(data as Material[] | null) ?? []}
      erroCarregar={error ? error.message : null}
    />
  );
}
