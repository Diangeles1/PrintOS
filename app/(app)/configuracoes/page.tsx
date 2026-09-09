import { createClient } from '@/lib/supabase/server';
import { requireDono } from '@/lib/equipe';

import ConfiguracoesForm, {
  type Empresa,
  type IngestToken,
  type Membro,
  type WhatsNumero,
} from './ConfiguracoesForm';

export default async function ConfiguracoesPage() {
  await requireDono();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: empresa }, { data: numeros }, { data: tokens }, { data: membros }] =
    await Promise.all([
      supabase.from('empresa').select('*').maybeSingle(),
      supabase
        .from('whatsapp_numeros')
        .select('id, numero, apelido')
        .order('created_at', { ascending: true }),
      supabase
        .from('ingest_tokens')
        .select('id, label, last_used_at, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('grafica_membros')
        .select('id, membro_id, papel, nome, ativo, created_at')
        .order('created_at', { ascending: true }),
    ]);

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
        numeros={(numeros as WhatsNumero[] | null) ?? []}
        botNumero={process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMERO ?? ''}
        tokens={(tokens as IngestToken[] | null) ?? []}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''}
        membros={((membros as Membro[] | null) ?? []).filter((m) => m.papel !== 'dono' || m.ativo)}
        donoId={user?.id ?? ''}
      />
    </div>
  );
}
