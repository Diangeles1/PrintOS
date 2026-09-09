import { createClient } from '@/lib/supabase/server';

import ConfiguracoesForm, { type Empresa } from './ConfiguracoesForm';

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: empresa } = await supabase.from('empresa').select('*').maybeSingle();

  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackNome =
    (typeof md.company_name === 'string' && md.company_name) ||
    (typeof md.display_name === 'string' && md.display_name) ||
    '';

  return (
    <div className="page">
      <h1 className="page-title">Configurações</h1>
      <p className="muted">Dados da empresa e padrões dos documentos.</p>

      <ConfiguracoesForm
        userId={user?.id ?? ''}
        empresa={(empresa as Empresa | null) ?? null}
        fallbackNome={fallbackNome}
      />
    </div>
  );
}
