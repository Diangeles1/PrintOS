'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type OrcamentoLista = {
  id: string;
  numero: number;
  cliente_nome: string | null;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  validade: string | null;
  total: number;
  created_at: string;
  orcamento_itens: { count: number }[];
};

const STATUS_LABEL: Record<OrcamentoLista['status'], string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

const FILTROS: { valor: 'todos' | OrcamentoLista['status']; label: string }[] = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'rascunho', label: 'Rascunho' },
  { valor: 'enviado', label: 'Enviado' },
  { valor: 'aprovado', label: 'Aprovado' },
  { valor: 'recusado', label: 'Recusado' },
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const data = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function OrcamentosList({
  initial,
  erroCarregar,
  validadeDias,
  condicoesPadrao,
}: {
  initial: OrcamentoLista[];
  erroCarregar: string | null;
  validadeDias: number;
  condicoesPadrao: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [filtro, setFiltro] = useState<'todos' | OrcamentoLista['status']>('todos');
  const [criando, setCriando] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const lista = useMemo(
    () => (filtro === 'todos' ? initial : initial.filter((o) => o.status === filtro)),
    [initial, filtro],
  );

  async function novo() {
    setCriando(true);
    const validade =
      validadeDias > 0
        ? new Date(Date.now() + validadeDias * 86400000).toISOString().slice(0, 10)
        : null;
    const { data: criado, error } = await supabase
      .from('orcamentos')
      .insert({ validade, observacoes: condicoesPadrao })
      .select('id')
      .single();
    setCriando(false);
    if (error || !criado) {
      window.alert(`Não foi possível criar. ${error?.message ?? ''}`);
      return;
    }
    router.push(`/orcamentos/${criado.id}`);
  }

  async function excluir(id: string) {
    setExcluindo(id);
    const { error } = await supabase.from('orcamentos').delete().eq('id', id);
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
      <h1 className="page-title">Orçamentos</h1>
      <p className="muted">Criação e acompanhamento de orçamentos.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabelas de orçamentos ainda não existem.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0005_orcamentos.sql</code> no Supabase e
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
          Novo orçamento
        </button>
      </div>

      {erroCarregar ? null : initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <FileText size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nenhum orçamento ainda</p>
          <p className="ax-empty-sub">Crie o primeiro orçamento e adicione itens do catálogo.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Data</th>
                <th className="mat-r">Itens</th>
                <th className="mat-r">Total</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {lista.map((o) => (
                <tr
                  key={o.id}
                  className="oc-row"
                  onClick={() => router.push(`/orcamentos/${o.id}`)}
                >
                  <td className="cl-nome">#{o.numero}</td>
                  <td>{o.cliente_nome || <span className="muted">Sem cliente</span>}</td>
                  <td>{data(o.created_at)}</td>
                  <td className="mat-r mat-num">{o.orcamento_itens?.[0]?.count ?? 0}</td>
                  <td className="mat-r mat-num">{brl(Number(o.total))}</td>
                  <td>
                    <span className={`cl-tag oc-st oc-st--${o.status}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {confirmar === o.id ? (
                      <div className="cl-confirm">
                        <span>Excluir?</span>
                        <button
                          type="button"
                          className="cl-confirm-yes"
                          onClick={() => excluir(o.id)}
                          disabled={excluindo === o.id}
                        >
                          {excluindo === o.id ? (
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
                          aria-label={`Excluir orçamento ${o.numero}`}
                          onClick={() => setConfirmar(o.id)}
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
                    Nenhum orçamento com esse status.
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
