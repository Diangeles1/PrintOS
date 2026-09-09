'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Pencil, Plus, Search, Trash2, Boxes, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type Material = {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  nome: string;
  categoria: string;
  unidade: string;
  custo: string;
  estoque: string;
  estoque_minimo: string;
  observacoes: string;
};

const VAZIO: FormState = {
  nome: '',
  categoria: '',
  unidade: 'un',
  custo: '',
  estoque: '',
  estoque_minimo: '',
  observacoes: '',
};

const UNIDADES = ['un', 'folha', 'pct', 'cx', 'm', 'm²', 'kg', 'g', 'L', 'ml'];
const CATEGORIAS = ['Papel', 'Tinta', 'Bobina', 'Acabamento', 'Embalagem', 'Outro'];

type Painel = { modo: 'novo' } | { modo: 'editar'; material: Material } | null;

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const num = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

function toNumber(s: string) {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function MateriaisView({
  initial,
  erroCarregar,
}: {
  initial: Material[];
  erroCarregar: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((m) =>
      [m.nome, m.categoria].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, busca]);

  function abrirNovo() {
    setForm(VAZIO);
    setErroForm(null);
    setPainel({ modo: 'novo' });
  }

  function abrirEditar(m: Material) {
    setForm({
      nome: m.nome,
      categoria: m.categoria ?? '',
      unidade: m.unidade,
      custo: String(m.custo ?? ''),
      estoque: String(m.estoque ?? ''),
      estoque_minimo: String(m.estoque_minimo ?? ''),
      observacoes: m.observacoes ?? '',
    });
    setErroForm(null);
    setPainel({ modo: 'editar', material: m });
  }

  function fechar() {
    if (!salvando) setPainel(null);
  }

  function setCampo<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erroForm) setErroForm(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErroForm('Informe o nome do material.');
      return;
    }
    setErroForm(null);
    setSalvando(true);

    const payload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim() || null,
      unidade: form.unidade.trim() || 'un',
      custo: toNumber(form.custo),
      estoque: toNumber(form.estoque),
      estoque_minimo: toNumber(form.estoque_minimo),
      observacoes: form.observacoes.trim() || null,
    };

    const resp =
      painel?.modo === 'editar'
        ? await supabase.from('materiais').update(payload).eq('id', painel.material.id)
        : await supabase.from('materiais').insert(payload);

    setSalvando(false);
    if (resp.error) {
      if (resp.error.code === '23505') {
        setErroForm('Já existe um material com esse nome.');
      } else if (resp.error.code === '23514') {
        setErroForm('Algum campo ficou fora do formato aceito. Revise os dados.');
      } else {
        setErroForm(`Não foi possível salvar. ${resp.error.message}`);
      }
      return;
    }
    setPainel(null);
    router.refresh();
  }

  async function excluir(m: Material) {
    setExcluindo(m.id);
    const { error } = await supabase.from('materiais').delete().eq('id', m.id);
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
      <h1 className="page-title">Materiais</h1>
      <p className="muted">Materiais, insumos, custos e estoque.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabela de materiais ainda não existe.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0002_materiais.sql</code> no SQL Editor do
              Supabase e recarregue.
            </span>
          </div>
        </div>
      )}

      <div className="cl-toolbar">
        <div className="cl-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome ou categoria…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button type="button" className="btn" onClick={abrirNovo} disabled={!!erroCarregar}>
          <Plus size={16} aria-hidden="true" />
          Novo material
        </button>
      </div>

      {erroCarregar ? null : initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <Boxes size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nenhum material ainda</p>
          <p className="ax-empty-sub">Cadastre o primeiro material para controlar custo e estoque.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Categoria</th>
                <th>Unid.</th>
                <th className="mat-r">Custo</th>
                <th className="mat-r">Estoque</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => {
                const baixo = m.estoque_minimo > 0 && m.estoque <= m.estoque_minimo;
                return (
                  <tr key={m.id}>
                    <td className="cl-nome">{m.nome}</td>
                    <td>{m.categoria || '—'}</td>
                    <td>{m.unidade}</td>
                    <td className="mat-r mat-num">{brl(Number(m.custo))}</td>
                    <td className="mat-r mat-num">
                      <span className="mat-estoque">
                        {num(Number(m.estoque))}
                        {baixo && <span className="mat-low">Baixo</span>}
                      </span>
                    </td>
                    <td>
                      {confirmar === m.id ? (
                        <div className="cl-confirm">
                          <span>Excluir?</span>
                          <button
                            type="button"
                            className="cl-confirm-yes"
                            onClick={() => excluir(m)}
                            disabled={excluindo === m.id}
                          >
                            {excluindo === m.id ? (
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
                            aria-label={`Editar ${m.nome}`}
                            onClick={() => abrirEditar(m)}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${m.nome}`}
                            onClick={() => setConfirmar(m.id)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="cl-vazio">
                    Nenhum material encontrado para “{busca}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {painel && (
        <div className="cl-overlay" onClick={fechar}>
          <form className="cl-panel" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
            <div className="cl-panel-head">
              <h2>{painel.modo === 'editar' ? 'Editar material' : 'Novo material'}</h2>
              <button type="button" aria-label="Fechar" onClick={fechar}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="cl-panel-body">
              <label className="cl-field">
                <span className="cl-label">Nome *</span>
                <input
                  className="cl-input"
                  autoFocus
                  value={form.nome}
                  onChange={(e) => setCampo('nome', e.target.value)}
                  placeholder="Ex.: Papel Couché 170g A4"
                />
              </label>

              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-label">Categoria</span>
                  <input
                    className="cl-input"
                    list="mat-categorias"
                    value={form.categoria}
                    onChange={(e) => setCampo('categoria', e.target.value)}
                    placeholder="Papel, Tinta…"
                  />
                  <datalist id="mat-categorias">
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="cl-field">
                  <span className="cl-label">Unidade</span>
                  <select
                    className="cl-input"
                    value={form.unidade}
                    onChange={(e) => setCampo('unidade', e.target.value)}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="cl-field">
                <span className="cl-label">Custo por {form.unidade} (R$)</span>
                <input
                  className="cl-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.custo}
                  onChange={(e) => setCampo('custo', e.target.value)}
                  placeholder="0,00"
                />
              </label>

              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-label">Estoque atual</span>
                  <input
                    className="cl-input"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={form.estoque}
                    onChange={(e) => setCampo('estoque', e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="cl-field">
                  <span className="cl-label">Estoque mínimo</span>
                  <input
                    className="cl-input"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={form.estoque_minimo}
                    onChange={(e) => setCampo('estoque_minimo', e.target.value)}
                    placeholder="0"
                  />
                </label>
              </div>

              <label className="cl-field">
                <span className="cl-label">Observações</span>
                <textarea
                  className="cl-input cl-textarea"
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setCampo('observacoes', e.target.value)}
                  placeholder="Fornecedor, especificações, etc."
                />
              </label>

              {erroForm && <p className="cl-form-err">{erroForm}</p>}
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
                ) : painel.modo === 'editar' ? (
                  'Salvar alterações'
                ) : (
                  'Cadastrar material'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
