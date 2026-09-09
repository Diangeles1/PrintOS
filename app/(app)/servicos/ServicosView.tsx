'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Pencil, Plus, Search, Sparkles, Tags, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CATALOGO_SERVICOS } from '@/lib/catalogo';

export type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  unidade: string;
  preco: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  nome: string;
  descricao: string;
  categoria: string;
  unidade: string;
  preco: string;
  ativo: boolean;
};

const VAZIO: FormState = {
  nome: '',
  descricao: '',
  categoria: '',
  unidade: 'un',
  preco: '',
  ativo: true,
};

const UNIDADES = ['un', 'folha', 'jogo', 'm', 'm²', 'kg', 'h', 'pct', 'cx'];
const CATEGORIAS = [
  'Impressão',
  'Cópia',
  'Comunicação Visual',
  'Acabamento',
  'Digital',
  'Documentos',
  'Outro',
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function toNumber(s: string) {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type Painel = { modo: 'novo' } | { modo: 'editar'; servico: Servico } | null;

export default function ServicosView({
  initial,
  erroCarregar,
}: {
  initial: Servico[];
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
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function catalogoSugerido() {
    setSeeding(true);
    setSeedMsg(null);
    const jaTem = new Set(initial.map((s) => s.nome.trim().toLowerCase()));
    const novos = CATALOGO_SERVICOS.filter((s) => !jaTem.has(s.nome.toLowerCase())).map((s) => ({
      nome: s.nome,
      categoria: s.categoria,
      unidade: s.unidade,
      preco: s.preco,
      ativo: true,
    }));
    if (novos.length === 0) {
      setSeeding(false);
      setSeedMsg('Todos os itens do catálogo sugerido já estão cadastrados.');
      return;
    }
    const { error } = await supabase.from('servicos').insert(novos);
    setSeeding(false);
    if (error) {
      setSeedMsg(`Não foi possível adicionar. ${error.message}`);
      return;
    }
    setSeedMsg(`${novos.length} serviços adicionados. Ajuste os preços como quiser.`);
    router.refresh();
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((s) =>
      [s.nome, s.categoria, s.descricao].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, busca]);

  function abrirNovo() {
    setForm(VAZIO);
    setErroForm(null);
    setPainel({ modo: 'novo' });
  }

  function abrirEditar(s: Servico) {
    setForm({
      nome: s.nome,
      descricao: s.descricao ?? '',
      categoria: s.categoria ?? '',
      unidade: s.unidade,
      preco: String(s.preco ?? ''),
      ativo: s.ativo,
    });
    setErroForm(null);
    setPainel({ modo: 'editar', servico: s });
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
      setErroForm('Informe o nome do serviço.');
      return;
    }
    setErroForm(null);
    setSalvando(true);

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria.trim() || null,
      unidade: form.unidade.trim() || 'un',
      preco: toNumber(form.preco),
      ativo: form.ativo,
    };

    const resp =
      painel?.modo === 'editar'
        ? await supabase.from('servicos').update(payload).eq('id', painel.servico.id)
        : await supabase.from('servicos').insert(payload);

    setSalvando(false);
    if (resp.error) {
      if (resp.error.code === '23505') {
        setErroForm('Já existe um serviço com esse nome.');
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

  async function excluir(s: Servico) {
    setExcluindo(s.id);
    const { error } = await supabase.from('servicos').delete().eq('id', s.id);
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
      <h1 className="page-title">Serviços e Produtos</h1>
      <p className="muted">Catálogo de preços usado nos orçamentos e na venda rápida.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabela de serviços ainda não existe.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0004_servicos.sql</code> no Supabase e
              recarregue.
            </span>
          </div>
        </div>
      )}

      <div className="cl-toolbar">
        <div className="cl-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome, categoria…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={catalogoSugerido}
          disabled={!!erroCarregar || seeding}
          title="Adiciona serviços comuns de gráfica (incl. documentos), pulando os que já existem"
        >
          {seeding ? (
            <Loader2 size={16} className="cl-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={16} aria-hidden="true" />
          )}
          Catálogo sugerido
        </button>
        <button type="button" className="btn" onClick={abrirNovo} disabled={!!erroCarregar}>
          <Plus size={16} aria-hidden="true" />
          Novo serviço
        </button>
      </div>
      {seedMsg && (
        <p className="login-mensagem" style={{ fontSize: 13, marginTop: -6, marginBottom: 12 }}>
          {seedMsg}
        </p>
      )}

      {erroCarregar ? null : initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <Tags size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nenhum serviço ainda</p>
          <p className="ax-empty-sub">Cadastre o que você vende para montar orçamentos rápido.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Categoria</th>
                <th>Unid.</th>
                <th className="mat-r">Preço</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s) => (
                <tr key={s.id} className={s.ativo ? undefined : 'sv-inativo'}>
                  <td className="cl-nome">{s.nome}</td>
                  <td>{s.categoria || '—'}</td>
                  <td>{s.unidade}</td>
                  <td className="mat-r mat-num">{brl(Number(s.preco))}</td>
                  <td>
                    <span className={`cl-tag ${s.ativo ? 'cx-in' : 'sv-tag-off'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    {confirmar === s.id ? (
                      <div className="cl-confirm">
                        <span>Excluir?</span>
                        <button
                          type="button"
                          className="cl-confirm-yes"
                          onClick={() => excluir(s)}
                          disabled={excluindo === s.id}
                        >
                          {excluindo === s.id ? (
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
                          aria-label={`Editar ${s.nome}`}
                          onClick={() => abrirEditar(s)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${s.nome}`}
                          onClick={() => setConfirmar(s.id)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="cl-vazio">
                    Nenhum serviço encontrado para “{busca}”.
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
              <h2>{painel.modo === 'editar' ? 'Editar serviço' : 'Novo serviço'}</h2>
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
                  placeholder="Ex.: Impressão A4 colorida"
                />
              </label>

              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-label">Categoria</span>
                  <input
                    className="cl-input"
                    list="sv-categorias"
                    value={form.categoria}
                    onChange={(e) => setCampo('categoria', e.target.value)}
                    placeholder="Impressão, Cópia…"
                  />
                  <datalist id="sv-categorias">
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
                <span className="cl-label">Preço por {form.unidade} (R$)</span>
                <input
                  className="cl-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.preco}
                  onChange={(e) => setCampo('preco', e.target.value)}
                  placeholder="0,00"
                />
              </label>

              <label className="cl-field">
                <span className="cl-label">Descrição</span>
                <textarea
                  className="cl-input cl-textarea"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setCampo('descricao', e.target.value)}
                  placeholder="Detalhes que aparecem no orçamento (opcional)"
                />
              </label>

              <label className="sv-switch">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setCampo('ativo', e.target.checked)}
                />
                <span>Serviço ativo (aparece na venda rápida e nos orçamentos)</span>
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
                  'Cadastrar serviço'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
