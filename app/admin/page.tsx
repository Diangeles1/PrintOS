import Link from 'next/link';

import { requireSuperadmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Conta = {
  user_id: string;
  email: string;
  display_name: string | null;
  criado_em: string;
  ultimo_login: string | null;
  email_confirmado: boolean;
  banido_ate: string | null;
  empresa_nome: string | null;
  n_clientes: number;
  n_pedidos: number;
  n_orcamentos: number;
  ultimo_pedido_em: string | null;
};

const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

function estado(c: Conta) {
  if (c.banido_ate && new Date(c.banido_ate) > new Date()) return { txt: 'Suspensa', cls: 'adm-tag--no' };
  if (!c.email_confirmado) return { txt: 'Não confirmada', cls: 'adm-tag--warn' };
  return { txt: 'Ativa', cls: 'adm-tag--ok' };
}

export default async function AdminContasPage() {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_resumo_contas');
  const contas = (data as Conta[] | null) ?? [];

  return (
    <div className="adm-page">
      <header className="adm-head">
        <h1>Contas ({contas.length})</h1>
        <p>Todas as gráficas cadastradas no PrintOS.</p>
      </header>

      {error && <p className="adm-err">Erro ao carregar: {error.message}</p>}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Gráfica / e-mail</th>
              <th>Estado</th>
              <th className="adm-num">Clientes</th>
              <th className="adm-num">Pedidos</th>
              <th className="adm-num">Orçam.</th>
              <th>Último login</th>
              <th>Criada</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => {
              const e = estado(c);
              return (
                <tr key={c.user_id}>
                  <td>
                    <div className="adm-conta">
                      <strong>{c.empresa_nome || c.display_name || '— sem nome —'}</strong>
                      <span>{c.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`adm-tag ${e.cls}`}>{e.txt}</span>
                  </td>
                  <td className="adm-num">{c.n_clientes}</td>
                  <td className="adm-num">{c.n_pedidos}</td>
                  <td className="adm-num">{c.n_orcamentos}</td>
                  <td>{dt(c.ultimo_login)}</td>
                  <td>{dt(c.criado_em)}</td>
                  <td>
                    <Link href={`/admin/contas/${c.user_id}`} className="adm-abrir">
                      Abrir
                    </Link>
                  </td>
                </tr>
              );
            })}
            {contas.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="adm-vazio">
                  Nenhuma conta ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
