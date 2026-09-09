'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type PedidoStatus =
  | 'aguardando_arte'
  | 'em_producao'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export type PedidoLista = {
  id: string;
  numero: number;
  cliente_nome: string | null;
  status: PedidoStatus;
  prazo: string | null;
  total: number;
  origem: string;
  created_at: string;
  pedido_itens: { count: number }[];
};

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  aguardando_arte: 'Aguardando arte',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const FILTROS: { valor: 'todos' | PedidoStatus; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'aguardando_arte', label: 'Aguardando arte' },
  { valor: 'em_producao', label: 'Em produção' },
  { valor: 'pronto', label: 'Pronto' },
  { valor: 'entregue', label: 'Entregue' },
  { valor: 'cancelado', label: 'Cancelado' },
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBR = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—';

export default function PedidosList({
  initial,
  erroCarregar,
}: {
  initial: PedidoLista[];
  erroCarregar: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [filtro, setFiltro] = useState<'todos' | PedidoStatus>('todos');
  const [criando, setCriando] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const lista = useMemo(
    () => (filtro === 'todos' ? initial : initial.filter((p) => p.status === filtro)),
    [initial, filtro],
  );

  async function novo() {
    setCriando(true);
    const { data, error } = await supabase.from('pedidos').insert({}).select('id').single();
    setCriando(false);
    if (error || !data) {
      window.alert(`Não foi possível criar. ${error?.message ?? ''}`);
      return;
    }
    router.push(`/pedidos/${data.id}`);
  }

  async function excluir(id: string) {
    setExcluindo(id);
    const { error } = await supabase.from('pedidos').delete().eq('id', id);
    setExcluindo(null);
    setConfirmar(null);
    if (error) {
      window.alert(`Não foi possível excluir. ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="page">
      <h1 className="page-title">Pedidos</h1>
      <p className="muted">Pedidos em produção e entrega.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabelas de pedidos ainda não existem.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0006_pedidos.sql</code> no Supabase e
              recarregue.
            </span>
          </div>
        </div>
      )}

      <div className="cl-toolbar">
        <div className="oc-filtros">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`oc-chip${filtro === f.valor ? ' is-on' : ''}`}
              onClick={() => setFiltro(f.valor)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={novo} disabled={!!erroCarregar || criando}>
          {criando ? (
            <Loader2 size={16} className="cl-spin" aria-hidden="true" />
          ) : (
            <Plus size={16} aria-hidden="true" />
          )}
          Novo pedido
        </button>
      </div>

      {erroCarregar ? null : initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <ClipboardList size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nenhum pedido ainda</p>
          <p className="ax-empty-sub">
            Aprove um orçamento e gere o pedido, ou crie um pedido direto.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Prazo</th>
                <th className="mat-r">Itens</th>
                <th className="mat-r">Total</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="oc-row" onClick={() => router.push(`/pedidos/${p.id}`)}>
                  <td className="cl-nome">
                    #{p.numero}
                    {(p.origem === 'whatsapp' || p.origem === 'whatsapp_ext') && (
                      <span className="pd-wa" title="Registrado pelo WhatsApp">
                        WhatsApp
                      </span>
                    )}
                  </td>
                  <td>{p.cliente_nome || <span className="muted">Sem cliente</span>}</td>
                  <td>{dataBR(p.prazo)}</td>
                  <td className="mat-r mat-num">{p.pedido_itens?.[0]?.count ?? 0}</td>
                  <td className="mat-r mat-num">{brl(Number(p.total))}</td>
                  <td>
                    <span className={`cl-tag pd-st pd-st--${p.status}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {confirmar === p.id ? (
                      <div className="cl-confirm">
                        <span>Excluir?</span>
                        <button
                          type="button"
                          className="cl-confirm-yes"
                          onClick={() => excluir(p.id)}
                          disabled={excluindo === p.id}
                        >
                          {excluindo === p.id ? (
                            <Loader2 size={14} className="cl-spin" aria-hidden="true" />
                          ) : (
                            'Sim'
                          )}
                        </button>
                        <button
                          type="button"
                          className="cl-confirm-no"
                          onClick={() => setConfirmar(null)}
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <div className="cl-actions">
                        <button
                          type="button"
                          aria-label={`Excluir pedido ${p.numero}`}
                          onClick={() => setConfirmar(p.id)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="cl-vazio">
                    Nenhum pedido com esse status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
