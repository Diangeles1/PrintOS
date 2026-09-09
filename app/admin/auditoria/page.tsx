import Link from 'next/link';

import { requireSuperadmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const ACAO_LABEL: Record<string, string> = {
  banir: 'Suspendeu acesso',
  desbanir: 'Reativou acesso',
  confirmar_email: 'Confirmou e-mail',
  reset_senha: 'Gerou link de senha',
  magiclink: 'Gerou link de acesso',
  salvar_nome: 'Editou nome',
  salvar_empresa: 'Editou dados da empresa',
  apagar_conta: 'Apagou a conta',
};

type Linha = {
  id: string;
  actor_email: string;
  acao: string;
  alvo_user_id: string | null;
  alvo_email: string | null;
  detalhe: Record<string, unknown>;
  created_at: string;
};

export default async function AuditoriaPage() {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  const linhas = (data as Linha[] | null) ?? [];

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Auditoria</h1>
        <p>Últimas 200 ações do console. Tudo que mexe em conta de gráfica é registrado aqui.</p>
      </header>

      {error && <p className="adm-err">Erro: {error.message}</p>}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Gráfica</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="adm-mono">
                  {new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                </td>
                <td>{l.actor_email}</td>
                <td>{ACAO_LABEL[l.acao] ?? l.acao}</td>
                <td>
                  {l.alvo_user_id ? (
                    <Link href={`/admin/contas/${l.alvo_user_id}`}>{l.alvo_email || l.alvo_user_id}</Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="adm-vazio">Nada registrado ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
