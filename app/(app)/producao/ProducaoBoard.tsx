'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Loader2, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type BoardStatus = 'aguardando_arte' | 'em_producao' | 'pronto';

export type PedidoCard = {
  id: string;
  numero: number;
  cliente_nome: string | null;
  status: BoardStatus;
  prazo: string | null;
  total: number;
};

const COLUNAS: { status: BoardStatus; label: string }[] = [
  { status: 'aguardando_arte', label: 'Aguardando arte' },
  { status: 'em_producao', label: 'Em produção' },
  { status: 'pronto', label: 'Pronto' },
];

const ORDEM: BoardStatus[] = ['aguardando_arte', 'em_producao', 'pronto'];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function prazoInfo(iso: string | null) {
  if (!iso) return { txt: 'Sem prazo', late: false };
  const d = new Date(iso + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const txt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (dias < 0) return { txt: `${txt} · atrasado`, late: true };
  if (dias === 0) return { txt: `${txt} · hoje`, late: true };
  if (dias === 1) return { txt: `${txt} · amanhã`, late: false };
  return { txt: `${txt} · ${dias}d`, late: false };
}

export default function ProducaoBoard({
  initial,
  erroCarregar,
}: {
  initial: PedidoCard[];
  erroCarregar: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [movendo, setMovendo] = useState<string | null>(null);

  const porColuna = useMemo(() => {
    const m: Record<BoardStatus, PedidoCard[]> = {
      aguardando_arte: [],
      em_producao: [],
      pronto: [],
    };
    for (const p of initial) m[p.status]?.push(p);
    return m;
  }, [initial]);

  async function mover(p: PedidoCard, dir: -1 | 1) {
    const idx = ORDEM.indexOf(p.status);
    let novo: string;
    if (dir === 1 && p.status === 'pronto') novo = 'entregue';
    else {
      const alvo = ORDEM[idx + dir];
      if (!alvo) return;
      novo = alvo;
    }
    setMovendo(p.id);
    const { error } = await supabase.from('pedidos').update({ status: novo }).eq('id', p.id);
    setMovendo(null);
    if (error) {
      window.alert(`Não foi possível mover. ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="page">
      <h1 className="page-title">Produção</h1>
      <p className="muted">Acompanhe cada pedido da arte até ficar pronto.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar os pedidos.</strong>
            <span>{erroCarregar}</span>
          </div>
        </div>
      )}

      {!erroCarregar && initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <PackageCheck size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nada em produção</p>
          <p className="ax-empty-sub">
            Pedidos com status arte / produção / pronto aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="pr-board">
          {COLUNAS.map((col) => (
            <div className="pr-col" key={col.status}>
              <div className="pr-col-head">
                <span>{col.label}</span>
                <span className="pr-count">{porColuna[col.status].length}</span>
              </div>
              <div className="pr-col-body">
                {porColuna[col.status].map((p) => {
                  const pz = prazoInfo(p.prazo);
                  const idx = ORDEM.indexOf(p.status);
                  return (
                    <div
                      className="pr-card"
                      key={p.id}
                      onClick={() => router.push(`/pedidos/${p.id}`)}
                    >
                      <div className="pr-card-top">
                        <strong>#{p.numero}</strong>
                        <span>{brl(Number(p.total))}</span>
                      </div>
                      <div className="pr-card-cli">
                        {p.cliente_nome || <span className="muted">Sem cliente</span>}
                      </div>
                      <div className={`pr-card-prazo${pz.late ? ' is-late' : ''}`}>
                        <CalendarClock size={13} aria-hidden="true" />
                        {pz.txt}
                      </div>
                      <div className="pr-card-mov" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="Voltar etapa"
                          disabled={idx === 0 || movendo === p.id}
                          onClick={() => mover(p, -1)}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={p.status === 'pronto' ? 'Marcar entregue' : 'Avançar etapa'}
                          disabled={movendo === p.id}
                          onClick={() => mover(p, 1)}
                        >
                          {movendo === p.id ? (
                            <Loader2 size={15} className="cl-spin" aria-hidden="true" />
                          ) : p.status === 'pronto' ? (
                            <PackageCheck size={15} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={15} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {porColuna[col.status].length === 0 && (
                  <p className="pr-vazio">Vazio</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
