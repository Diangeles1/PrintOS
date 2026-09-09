import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FileText,
  TrendingUp,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { requireDono } from '@/lib/equipe';

const STATUS_LABEL: Record<string, string> = {
  aguardando_arte: 'Aguardando arte',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const ABERTOS = ['aguardando_arte', 'em_producao', 'pronto'];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

function inicioDeHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  await requireDono();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const nome =
    (typeof md.display_name === 'string' && md.display_name) ||
    (typeof md.full_name === 'string' && md.full_name) ||
    'por aí';

  const hoje = inicioDeHoje().toISOString();
  const hojeData = inicioDeHoje().toLocaleDateString('sv-SE');

  const [entreguesHoje, abertos, atrasados, orcAbertos, recentes] = await Promise.all([
    supabase.from('pedidos').select('total').eq('status', 'entregue').gte('updated_at', hoje),
    supabase.from('pedidos').select('id', { count: 'exact', head: true }).in('status', ABERTOS),
    supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .in('status', ABERTOS)
      .not('prazo', 'is', null)
      .lt('prazo', hojeData),
    supabase.from('orcamentos').select('id', { count: 'exact', head: true }).eq('status', 'enviado'),
    supabase
      .from('pedidos')
      .select('id, numero, cliente_nome, status, prazo')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const vendasHoje = (entreguesHoje.data ?? []).reduce(
    (acc, p) => acc + Number((p as { total: number }).total || 0),
    0,
  );
  const nAtrasados = atrasados.count ?? 0;
  const erro =
    entreguesHoje.error || abertos.error || atrasados.error || orcAbertos.error || recentes.error;

  return (
    <div className="page">
      <h1 className="page-title">Olá, {nome}!</h1>
      <p className="muted">Aqui está o resumo de hoje.</p>

      {erro && (
        <div className="cl-banner" style={{ marginBottom: 16 }}>
          <div>
            <strong>Não foi possível carregar alguns números.</strong>
            <span>Recarregue a página. Se persistir, confira as migrações do Supabase.</span>
          </div>
        </div>
      )}

      <div className="cards">
        <Kpi
          title="Entregues hoje"
          value={brl(vendasHoje)}
          icon={<TrendingUp size={16} aria-hidden="true" />}
          tone="ok"
        />
        <Kpi
          title="Pedidos em aberto"
          value={String(abertos.count ?? 0)}
          icon={<ClipboardList size={16} aria-hidden="true" />}
        />
        <Kpi
          title="Atrasados"
          value={String(nAtrasados)}
          icon={<AlertTriangle size={16} aria-hidden="true" />}
          tone={nAtrasados > 0 ? 'danger' : 'default'}
        />
        <Kpi
          title="Orçamentos aguardando"
          value={String(orcAbertos.count ?? 0)}
          icon={<FileText size={16} aria-hidden="true" />}
        />
      </div>

      <div className="actions">
        <Link className="btn" href="/venda-rapida">
          Venda rápida
        </Link>
        <Link className="btn secondary" href="/orcamentos">
          Novo orçamento
        </Link>
        <Link className="btn secondary" href="/producao">
          Produção
        </Link>
      </div>

      <div className="dash-tabela">
        <div className="dash-tabela-head">
          <h2>Últimos pedidos</h2>
          <Link href="/pedidos" className="dash-vertudo">
            Ver todos <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {(recentes.data ?? []).map((p) => {
                const ped = p as {
                  id: string;
                  numero: number;
                  cliente_nome: string | null;
                  status: string;
                  prazo: string | null;
                };
                return (
                  <tr key={ped.id} className="dash-row">
                    <td>
                      <Link href={`/pedidos/${ped.id}`} className="dash-ped">
                        #{ped.numero}
                      </Link>
                    </td>
                    <td>{ped.cliente_nome || <span className="muted">Sem cliente</span>}</td>
                    <td>
                      <span className={`cl-tag pd-st pd-st--${ped.status}`}>
                        {STATUS_LABEL[ped.status] ?? ped.status}
                      </span>
                    </td>
                    <td>{dataBR(ped.prazo)}</td>
                  </tr>
                );
              })}
              {(recentes.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 22 }}>
                    Nenhum pedido ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'ok' | 'danger';
}) {
  return (
    <section className={`card kpi-card kpi-card--${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{title}</span>
        <span className="kpi-ico" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="kpi">{value}</div>
    </section>
  );
}
