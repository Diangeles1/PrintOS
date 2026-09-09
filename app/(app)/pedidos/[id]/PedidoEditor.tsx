'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import { STATUS_LABEL, type PedidoStatus } from '../PedidosList';

export type Pedido = {
  id: string;
  numero: number;
  orcamento_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  status: PedidoStatus;
  prazo: string | null;
  desconto: number;
  subtotal: number;
  total: number;
  observacoes: string | null;
  origem: string;
  origem_texto: string | null;
};

export type ItemPed = {
  id: string;
  servico_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  ordem: number;
};

export type ClienteOpc = { id: string; nome: string };
export type ServicoOpc = { id: string; nome: string; preco: number; unidade: string };

type Linha = {
  key: string;
  id: string | null;
  servico_id: string | null;
  descricao: string;
  quantidade: string;
  preco_unitario: string;
};

const FLUXO: PedidoStatus[] = [
  'aguardando_arte',
  'em_producao',
  'pronto',
  'entregue',
  'cancelado',
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function toNumber(s: string, min = 0) {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n >= min ? n : min;
}

let seq = 0;
const novaKey = () => `l${Date.now()}_${seq++}`;

export default function PedidoEditor({
  pedido,
  itens,
  clientes,
  servicos,
}: {
  pedido: Pedido;
  itens: ItemPed[];
  clientes: ClienteOpc[];
  servicos: ServicoOpc[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [clienteId, setClienteId] = useState(pedido.cliente_id ?? '');
  const [clienteNome, setClienteNome] = useState(pedido.cliente_nome ?? '');
  const [prazo, setPrazo] = useState(pedido.prazo ?? '');
  const [desconto, setDesconto] = useState(String(pedido.desconto ?? ''));
  const [observacoes, setObservacoes] = useState(pedido.observacoes ?? '');
  const [status, setStatus] = useState<PedidoStatus>(pedido.status);

  const [linhas, setLinhas] = useState<Linha[]>(
    itens.map((i) => ({
      key: novaKey(),
      id: i.id,
      servico_id: i.servico_id,
      descricao: i.descricao,
      quantidade: String(i.quantidade),
      preco_unitario: String(i.preco_unitario),
    })),
  );
  const idsIniciais = useMemo(() => new Set(itens.map((i) => i.id)), [itens]);

  const [salvando, setSalvando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState<PedidoStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const subtotal = useMemo(
    () => linhas.reduce((acc, l) => acc + toNumber(l.quantidade) * toNumber(l.preco_unitario), 0),
    [linhas],
  );
  const total = Math.max(subtotal - toNumber(desconto), 0);

  function setLinha(key: string, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setMsg(null);
  }
  function addVazia() {
    setLinhas((ls) => [
      ...ls,
      { key: novaKey(), id: null, servico_id: null, descricao: '', quantidade: '1', preco_unitario: '0' },
    ]);
  }
  function addCatalogo(id: string) {
    const s = servicos.find((x) => x.id === id);
    if (!s) return;
    setLinhas((ls) => [
      ...ls,
      {
        key: novaKey(),
        id: null,
        servico_id: s.id,
        descricao: s.nome,
        quantidade: '1',
        preco_unitario: String(s.preco),
      },
    ]);
  }
  function remover(key: string) {
    setLinhas((ls) => ls.filter((l) => l.key !== key));
    setMsg(null);
  }

  async function salvar() {
    setErro(null);
    setMsg(null);
    setSalvando(true);

    const upd = await supabase
      .from('pedidos')
      .update({
        cliente_id: clienteId || null,
        cliente_nome:
          clienteNome.trim() || clientes.find((c) => c.id === clienteId)?.nome || null,
        prazo: prazo || null,
        desconto: toNumber(desconto),
        observacoes: observacoes.trim() || null,
      })
      .eq('id', pedido.id);
    if (upd.error) {
      setSalvando(false);
      setErro(`Não foi possível salvar. ${upd.error.message}`);
      return;
    }

    const mantidos = new Set(linhas.filter((l) => l.id).map((l) => l.id as string));
    const remover = [...idsIniciais].filter((id) => !mantidos.has(id));
    if (remover.length) {
      const del = await supabase.from('pedido_itens').delete().in('id', remover);
      if (del.error) {
        setSalvando(false);
        setErro(`Erro ao remover itens. ${del.error.message}`);
        return;
      }
    }

    const existentes = linhas
      .filter((l) => l.id)
      .map((l, idx) => ({
        id: l.id as string,
        servico_id: l.servico_id,
        descricao: l.descricao.trim() || 'Item',
        quantidade: toNumber(l.quantidade, 0.001) || 1,
        preco_unitario: toNumber(l.preco_unitario),
        ordem: idx,
      }));
    if (existentes.length) {
      const up = await supabase.from('pedido_itens').upsert(existentes);
      if (up.error) {
        setSalvando(false);
        setErro(`Erro ao salvar itens. ${up.error.message}`);
        return;
      }
    }

    const base = existentes.length;
    const novos = linhas
      .filter((l) => !l.id)
      .map((l, idx) => ({
        pedido_id: pedido.id,
        servico_id: l.servico_id,
        descricao: l.descricao.trim() || 'Item',
        quantidade: toNumber(l.quantidade, 0.001) || 1,
        preco_unitario: toNumber(l.preco_unitario),
        ordem: base + idx,
      }));
    if (novos.length) {
      const ins = await supabase.from('pedido_itens').insert(novos);
      if (ins.error) {
        setSalvando(false);
        setErro(`Erro ao adicionar itens. ${ins.error.message}`);
        return;
      }
    }

    setSalvando(false);
    setMsg('Pedido salvo.');
    router.refresh();
  }

  async function mudarStatus(novo: PedidoStatus) {
    if (novo === status) return;
    setMudandoStatus(novo);
    const { error } = await supabase.from('pedidos').update({ status: novo }).eq('id', pedido.id);
    setMudandoStatus(null);
    if (error) {
      setErro(`Não foi possível mudar o status. ${error.message}`);
      return;
    }
    setStatus(novo);
    router.refresh();
  }

  return (
    <div className="page">
      <div className="oc-editor-top">
        <Link href="/pedidos" className="oc-voltar">
          <ArrowLeft size={16} aria-hidden="true" />
          Pedidos
        </Link>
        <h1 className="page-title" style={{ margin: '6px 0 0' }}>
          Pedido #{pedido.numero}
          {pedido.orcamento_id && (
            <Link href={`/orcamentos/${pedido.orcamento_id}`} className="pd-origem">
              do orçamento
            </Link>
          )}
        </h1>
      </div>

      {pedido.origem === 'whatsapp' && pedido.origem_texto && (
        <details className="pd-msg">
          <summary>Mensagem original do WhatsApp</summary>
          <p>{pedido.origem_texto}</p>
        </details>
      )}

      <div className="oc-status-row">
        {FLUXO.map((s) => (
          <button
            key={s}
            type="button"
            className={`oc-chip oc-chip--st pd-st--${s}${status === s ? ' is-on' : ''}`}
            onClick={() => mudarStatus(s)}
            disabled={mudandoStatus !== null}
          >
            {mudandoStatus === s ? <Loader2 size={13} className="cl-spin" /> : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="oc-grid">
        <label className="cl-field">
          <span className="cl-label">Cliente</span>
          <select
            className="cl-input"
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              const c = clientes.find((x) => x.id === e.target.value);
              if (c) setClienteNome(c.nome);
            }}
          >
            <option value="">— Cliente avulso —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="cl-field">
          <span className="cl-label">Nome no pedido</span>
          <input
            className="cl-input"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            placeholder="Nome exibido"
          />
        </label>
        <label className="cl-field">
          <span className="cl-label">Prazo de entrega</span>
          <input
            className="cl-input"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
        </label>
      </div>

      <div className="oc-itens-head">
        <h2 className="cx-h2" style={{ margin: 0 }}>
          Itens
        </h2>
        <div className="oc-add">
          <select
            className="cl-input"
            value=""
            onChange={(e) => {
              if (e.target.value) addCatalogo(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">Adicionar do catálogo…</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} — {brl(Number(s.preco))}/{s.unidade}
              </option>
            ))}
          </select>
          <button type="button" className="btn secondary" onClick={addVazia}>
            <Plus size={16} aria-hidden="true" />
            Item livre
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="oc-col-num">Qtd.</th>
              <th className="oc-col-num">Preço un.</th>
              <th className="mat-r">Subtotal</th>
              <th aria-label="Remover" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.key}>
                <td>
                  <input
                    className="oc-cell"
                    value={l.descricao}
                    onChange={(e) => setLinha(l.key, { descricao: e.target.value })}
                    placeholder="Descrição do item"
                  />
                </td>
                <td className="oc-col-num">
                  <input
                    className="oc-cell oc-cell--num"
                    type="number"
                    min="0"
                    step="0.001"
                    value={l.quantidade}
                    onChange={(e) => setLinha(l.key, { quantidade: e.target.value })}
                  />
                </td>
                <td className="oc-col-num">
                  <input
                    className="oc-cell oc-cell--num"
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.preco_unitario}
                    onChange={(e) => setLinha(l.key, { preco_unitario: e.target.value })}
                  />
                </td>
                <td className="mat-r mat-num">
                  {brl(toNumber(l.quantidade) * toNumber(l.preco_unitario))}
                </td>
                <td>
                  <div className="cl-actions">
                    <button type="button" aria-label="Remover item" onClick={() => remover(l.key)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="cl-vazio">
                  Nenhum item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="oc-fim">
        <label className="cl-field oc-obs">
          <span className="cl-label">Observações</span>
          <textarea
            className="cl-input cl-textarea"
            rows={4}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Instruções de produção, acabamento…"
          />
        </label>

        <div className="oc-totais">
          <div className="oc-tot-linha">
            <span>Subtotal</span>
            <strong>{brl(subtotal)}</strong>
          </div>
          <div className="oc-tot-linha">
            <span>Desconto (R$)</span>
            <input
              className="cl-input oc-desc"
              type="number"
              min="0"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="oc-tot-linha oc-tot-total">
            <span>Total</span>
            <strong>{brl(total)}</strong>
          </div>
        </div>
      </div>

      {erro && <p className="cl-form-err">{erro}</p>}
      {msg && (
        <p className="login-mensagem" style={{ fontSize: 13 }}>
          {msg}
        </p>
      )}

      <div className="oc-acoes">
        <Link href="/pedidos" className="btn secondary">
          Voltar
        </Link>
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? (
            <>
              <Loader2 size={16} className="cl-spin" aria-hidden="true" />
              Salvando…
            </>
          ) : (
            'Salvar pedido'
          )}
        </button>
      </div>
    </div>
  );
}
