'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Lock,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type Sessao = {
  id: string;
  status: 'aberto' | 'fechado';
  valor_abertura: number;
  valor_esperado: number | null;
  valor_fechamento: number | null;
  observacoes: string | null;
  aberto_em: string;
  fechado_em: string | null;
};

export type Movimento = {
  id: string;
  sessao_id: string;
  tipo: 'entrada' | 'saida';
  categoria: string | null;
  descricao: string;
  valor: number;
  created_at: string;
};

const CATEGORIAS = ['Venda', 'Sangria', 'Suprimento', 'Despesa', 'Troco', 'Outro'];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function toNumber(s: string) {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type Painel = null | 'abrir' | 'entrada' | 'saida' | 'fechar';

export default function CaixaView({
  sessao,
  movimentos,
  historico,
  erroCarregar,
}: {
  sessao: Sessao | null;
  movimentos: Movimento[];
  historico: Sessao[];
  erroCarregar: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [painel, setPainel] = useState<Painel>(null);
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const { entradas, saidas, saldo } = useMemo(() => {
    let e = 0;
    let s = 0;
    for (const m of movimentos) {
      if (m.tipo === 'entrada') e += Number(m.valor);
      else s += Number(m.valor);
    }
    return {
      entradas: e,
      saidas: s,
      saldo: Number(sessao?.valor_abertura ?? 0) + e - s,
    };
  }, [movimentos, sessao]);

  function abrirPainel(p: Painel) {
    setValor('');
    setCategoria('');
    setDescricao('');
    setObs('');
    setErro(null);
    setPainel(p);
  }

  function fechar() {
    if (!salvando) setPainel(null);
  }

  async function abrirCaixa(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const { error } = await supabase
      .from('caixa_sessoes')
      .insert({ valor_abertura: toNumber(valor), observacoes: obs.trim() || null });
    setSalvando(false);
    if (error) {
      setErro(
        error.code === '23505'
          ? 'Já existe um caixa aberto.'
          : `Não foi possível abrir. ${error.message}`,
      );
      return;
    }
    setPainel(null);
    router.refresh();
  }

  async function lancar(e: FormEvent) {
    e.preventDefault();
    if (!sessao) return;
    const v = toNumber(valor);
    if (v <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (!descricao.trim()) {
      setErro('Descreva o movimento.');
      return;
    }
    setErro(null);
    setSalvando(true);
    const { error } = await supabase.from('caixa_movimentos').insert({
      sessao_id: sessao.id,
      tipo: painel === 'saida' ? 'saida' : 'entrada',
      categoria: categoria.trim() || null,
      descricao: descricao.trim(),
      valor: v,
    });
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível lançar. ${error.message}`);
      return;
    }
    setPainel(null);
    router.refresh();
  }

  async function fecharCaixa(e: FormEvent) {
    e.preventDefault();
    if (!sessao) return;
    setErro(null);
    setSalvando(true);
    const { error } = await supabase
      .from('caixa_sessoes')
      .update({
        status: 'fechado',
        valor_esperado: saldo,
        valor_fechamento: toNumber(valor),
        fechado_em: new Date().toISOString(),
        observacoes: obs.trim() || sessao.observacoes,
      })
      .eq('id', sessao.id);
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível fechar. ${error.message}`);
      return;
    }
    setPainel(null);
    router.refresh();
  }

  async function excluirMov(id: string) {
    setExcluindo(id);
    const { error } = await supabase.from('caixa_movimentos').delete().eq('id', id);
    setExcluindo(null);
    setConfirmar(null);
    if (error) {
      window.alert(`Não foi possível excluir. ${error.message}`);
      return;
    }
    router.refresh();
  }

  const contado = toNumber(valor);
  const diferenca = contado - saldo;

  return (
    <div className="page">
      <h1 className="page-title">Caixa</h1>
      <p className="muted">Abertura, entradas, saídas e fechamento.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabelas do caixa ainda não existem.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0003_caixa.sql</code> no Supabase e recarregue.
            </span>
          </div>
        </div>
      )}

      {!erroCarregar && !sessao && (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <Lock size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Caixa fechado</p>
          <p className="ax-empty-sub">Abra o caixa para registrar entradas e saídas do dia.</p>
          <button type="button" className="btn" onClick={() => abrirPainel('abrir')} style={{ marginTop: 14 }}>
            <Unlock size={16} aria-hidden="true" />
            Abrir caixa
          </button>
        </div>
      )}

      {!erroCarregar && sessao && (
        <>
          <div className="cx-strip">
            <div className="cx-stat">
              <span>Abertura</span>
              <strong>{brl(sessao.valor_abertura)}</strong>
            </div>
            <div className="cx-stat cx-stat--in">
              <span>Entradas</span>
              <strong>{brl(entradas)}</strong>
            </div>
            <div className="cx-stat cx-stat--out">
              <span>Saídas</span>
              <strong>{brl(saidas)}</strong>
            </div>
            <div className="cx-stat cx-stat--saldo">
              <span>Saldo atual</span>
              <strong>{brl(saldo)}</strong>
            </div>
          </div>

          <div className="cx-bar">
            <p className="muted" style={{ margin: 0 }}>
              Aberto em {dataHora(sessao.aberto_em)}
            </p>
            <div className="cx-bar-actions">
              <button type="button" className="btn secondary" onClick={() => abrirPainel('entrada')}>
                <ArrowUpCircle size={16} aria-hidden="true" />
                Entrada
              </button>
              <button type="button" className="btn secondary" onClick={() => abrirPainel('saida')}>
                <ArrowDownCircle size={16} aria-hidden="true" />
                Saída
              </button>
              <button type="button" className="btn" onClick={() => abrirPainel('fechar')}>
                <Lock size={16} aria-hidden="true" />
                Fechar caixa
              </button>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: 6 }}>
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th className="mat-r">Valor</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => (
                  <tr key={m.id}>
                    <td>{hora(m.created_at)}</td>
                    <td>
                      <span className={`cl-tag ${m.tipo === 'entrada' ? 'cx-in' : 'cx-out'}`}>
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td>{m.categoria || '—'}</td>
                    <td className="cl-nome">{m.descricao}</td>
                    <td className={`mat-r mat-num ${m.tipo === 'entrada' ? 'cx-vin' : 'cx-vout'}`}>
                      {m.tipo === 'entrada' ? '+' : '−'} {brl(m.valor)}
                    </td>
                    <td>
                      {confirmar === m.id ? (
                        <div className="cl-confirm">
                          <span>Excluir?</span>
                          <button
                            type="button"
                            className="cl-confirm-yes"
                            onClick={() => excluirMov(m.id)}
                            disabled={excluindo === m.id}
                          >
                            {excluindo === m.id ? (
                              <Loader2 size={14} className="cl-spin" aria-hidden="true" />
                            ) : (
                              'Sim'
                            )}
                          </button>
                          <button type="button" className="cl-confirm-no" onClick={() => setConfirmar(null)}>
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="cl-actions">
                          <button type="button" aria-label="Excluir movimento" onClick={() => setConfirmar(m.id)}>
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {movimentos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="cl-vazio">
                      Nenhum movimento nesta sessão ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!erroCarregar && historico.length > 0 && (
        <>
          <h2 className="cx-h2">Sessões anteriores</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Abertura</th>
                  <th>Fechamento</th>
                  <th className="mat-r">Esperado</th>
                  <th className="mat-r">Contado</th>
                  <th className="mat-r">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((s) => {
                  const esperado =
                    s.valor_esperado != null ? Number(s.valor_esperado) : Number(s.valor_abertura);
                  const dif =
                    s.valor_fechamento != null ? Number(s.valor_fechamento) - esperado : null;
                  return (
                    <tr key={s.id}>
                      <td>{dataHora(s.aberto_em)}</td>
                      <td>{s.fechado_em ? dataHora(s.fechado_em) : '—'}</td>
                      <td className="mat-r mat-num">{brl(esperado)}</td>
                      <td className="mat-r mat-num">
                        {s.valor_fechamento != null ? brl(s.valor_fechamento) : '—'}
                      </td>
                      <td
                        className={`mat-r mat-num ${
                          dif == null ? '' : dif > 0 ? 'cx-vin' : dif < 0 ? 'cx-vout' : ''
                        }`}
                      >
                        {dif != null ? brl(dif) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {painel && (
        <div className="cl-overlay" onClick={fechar}>
          <form
            className="cl-panel"
            onClick={(ev) => ev.stopPropagation()}
            onSubmit={
              painel === 'abrir' ? abrirCaixa : painel === 'fechar' ? fecharCaixa : lancar
            }
          >
            <div className="cl-panel-head">
              <h2>
                {painel === 'abrir'
                  ? 'Abrir caixa'
                  : painel === 'fechar'
                    ? 'Fechar caixa'
                    : painel === 'saida'
                      ? 'Registrar saída'
                      : 'Registrar entrada'}
              </h2>
              <button type="button" aria-label="Fechar" onClick={fechar}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="cl-panel-body">
              {painel === 'fechar' && (
                <div className="cx-esperado">
                  <span>Saldo esperado</span>
                  <strong>{brl(saldo)}</strong>
                </div>
              )}

              <label className="cl-field">
                <span className="cl-label">
                  {painel === 'abrir'
                    ? 'Valor de abertura (R$)'
                    : painel === 'fechar'
                      ? 'Valor contado (R$)'
                      : 'Valor (R$)'}
                </span>
                <input
                  className="cl-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  autoFocus
                  value={valor}
                  onChange={(ev) => {
                    setValor(ev.target.value);
                    if (erro) setErro(null);
                  }}
                  placeholder="0,00"
                />
              </label>

              {painel === 'fechar' && valor !== '' && (
                <div
                  className={`cx-dif ${
                    diferenca > 0 ? 'cx-dif--sobra' : diferenca < 0 ? 'cx-dif--falta' : ''
                  }`}
                >
                  {diferenca === 0
                    ? 'Sem diferença'
                    : diferenca > 0
                      ? `Sobra de ${brl(diferenca)}`
                      : `Falta de ${brl(Math.abs(diferenca))}`}
                </div>
              )}

              {(painel === 'entrada' || painel === 'saida') && (
                <>
                  <label className="cl-field">
                    <span className="cl-label">Categoria</span>
                    <input
                      className="cl-input"
                      list="cx-categorias"
                      value={categoria}
                      onChange={(ev) => setCategoria(ev.target.value)}
                      placeholder="Venda, Sangria…"
                    />
                    <datalist id="cx-categorias">
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </label>
                  <label className="cl-field">
                    <span className="cl-label">Descrição *</span>
                    <input
                      className="cl-input"
                      value={descricao}
                      onChange={(ev) => {
                        setDescricao(ev.target.value);
                        if (erro) setErro(null);
                      }}
                      placeholder="Ex.: Venda balcão, sangria para banco…"
                    />
                  </label>
                </>
              )}

              {(painel === 'abrir' || painel === 'fechar') && (
                <label className="cl-field">
                  <span className="cl-label">Observações</span>
                  <textarea
                    className="cl-input cl-textarea"
                    rows={3}
                    value={obs}
                    onChange={(ev) => setObs(ev.target.value)}
                    placeholder="Opcional"
                  />
                </label>
              )}

              {erro && <p className="cl-form-err">{erro}</p>}
            </div>

            <div className="cl-panel-foot">
              <button type="button" className="btn secondary" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="btn" disabled={salvando}>
                {salvando ? (
                  <>
                    <Loader2 size={16} className="cl-spin" aria-hidden="true" />
                    Salvando…
                  </>
                ) : painel === 'abrir' ? (
                  'Abrir caixa'
                ) : painel === 'fechar' ? (
                  'Confirmar fechamento'
                ) : (
                  'Lançar'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
