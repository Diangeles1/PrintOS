'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type Cliente = {
  id: string;
  nome: string;
  tipo: 'pessoa' | 'empresa';
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  nome: string;
  tipo: 'pessoa' | 'empresa';
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  observacoes: string;
};

const VAZIO: FormState = {
  nome: '',
  tipo: 'pessoa',
  documento: '',
  email: '',
  telefone: '',
  endereco: '',
  observacoes: '',
};

type Painel = { modo: 'novo' } | { modo: 'editar'; cliente: Cliente } | null;

export default function ClientesView({
  initial,
  erroCarregar,
}: {
  initial: Cliente[];
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
    return initial.filter((c) =>
      [c.nome, c.documento, c.email, c.telefone].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, busca]);

  function abrirNovo() {
    setForm(VAZIO);
    setErroForm(null);
    setPainel({ modo: 'novo' });
  }

  function abrirEditar(c: Cliente) {
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      documento: c.documento ?? '',
      email: c.email ?? '',
      telefone: c.telefone ?? '',
      endereco: c.endereco ?? '',
      observacoes: c.observacoes ?? '',
    });
    setErroForm(null);
    setPainel({ modo: 'editar', cliente: c });
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
      setErroForm('Informe o nome do cliente.');
      return;
    }
    setErroForm(null);
    setSalvando(true);

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      documento: form.documento.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };

    const resp =
      painel?.modo === 'editar'
        ? await supabase.from('clientes').update(payload).eq('id', painel.cliente.id)
        : await supabase.from('clientes').insert(payload);

    setSalvando(false);
    if (resp.error) {
      setErroForm(`Não foi possível salvar. ${resp.error.message}`);
      return;
    }
    setPainel(null);
    router.refresh();
  }

  async function excluir(c: Cliente) {
    setExcluindo(c.id);
    const { error } = await supabase.from('clientes').delete().eq('id', c.id);
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
      <h1 className="page-title">Clientes</h1>
      <p className="muted">Cadastro e histórico de clientes.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Tabela de clientes ainda não existe.</strong>
            <span>
              Rode o SQL de <code>supabase/migrations/0001_clientes.sql</code> no SQL Editor do
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
            placeholder="Buscar por nome, documento, e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button type="button" className="btn" onClick={abrirNovo} disabled={!!erroCarregar}>
          <Plus size={16} aria-hidden="true" />
          Novo cliente
        </button>
      </div>

      {erroCarregar ? null : initial.length === 0 ? (
        <div className="ax-empty">
          <span className="ax-empty-ico" aria-hidden="true">
            <User size={22} strokeWidth={2} />
          </span>
          <p className="ax-empty-title">Nenhum cliente ainda</p>
          <p className="ax-empty-sub">Cadastre o primeiro cliente para começar.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Documento</th>
                <th>Contato</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td className="cl-nome">{c.nome}</td>
                  <td>
                    <span className={`cl-tag cl-tag--${c.tipo}`}>
                      {c.tipo === 'empresa' ? (
                        <Building2 size={13} aria-hidden="true" />
                      ) : (
                        <User size={13} aria-hidden="true" />
                      )}
                      {c.tipo === 'empresa' ? 'Empresa' : 'Pessoa'}
                    </span>
                  </td>
                  <td>{c.documento || '—'}</td>
                  <td>
                    <div className="cl-contato">
                      <span>{c.telefone || '—'}</span>
                      {c.email && <small>{c.email}</small>}
                    </div>
                  </td>
                  <td>
                    {confirmar === c.id ? (
                      <div className="cl-confirm">
                        <span>Excluir?</span>
                        <button
                          type="button"
                          className="cl-confirm-yes"
                          onClick={() => excluir(c)}
                          disabled={excluindo === c.id}
                        >
                          {excluindo === c.id ? (
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
                          aria-label={`Editar ${c.nome}`}
                          onClick={() => abrirEditar(c)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${c.nome}`}
                          onClick={() => setConfirmar(c.id)}
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
                  <td colSpan={5} className="cl-vazio">
                    Nenhum cliente encontrado para “{busca}”.
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
              <h2>{painel.modo === 'editar' ? 'Editar cliente' : 'Novo cliente'}</h2>
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
                  placeholder="Nome do cliente ou empresa"
                />
              </label>

              <div className="cl-field">
                <span className="cl-label">Tipo</span>
                <div className="cl-seg">
                  <button
                    type="button"
                    className={form.tipo === 'pessoa' ? 'is-on' : ''}
                    onClick={() => setCampo('tipo', 'pessoa')}
                  >
                    <User size={14} aria-hidden="true" />
                    Pessoa
                  </button>
                  <button
                    type="button"
                    className={form.tipo === 'empresa' ? 'is-on' : ''}
                    onClick={() => setCampo('tipo', 'empresa')}
                  >
                    <Building2 size={14} aria-hidden="true" />
                    Empresa
                  </button>
                </div>
              </div>

              <div className="cl-row2">
                <label className="cl-field">
                  <span className="cl-label">{form.tipo === 'empresa' ? 'CNPJ' : 'CPF'}</span>
                  <input
                    className="cl-input"
                    value={form.documento}
                    onChange={(e) => setCampo('documento', e.target.value)}
                    placeholder="Somente números"
                  />
                </label>
                <label className="cl-field">
                  <span className="cl-label">Telefone</span>
                  <input
                    className="cl-input"
                    value={form.telefone}
                    onChange={(e) => setCampo('telefone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </label>
              </div>

              <label className="cl-field">
                <span className="cl-label">E-mail</span>
                <input
                  className="cl-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setCampo('email', e.target.value)}
                  placeholder="cliente@email.com"
                />
              </label>

              <label className="cl-field">
                <span className="cl-label">Endereço</span>
                <input
                  className="cl-input"
                  value={form.endereco}
                  onChange={(e) => setCampo('endereco', e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </label>

              <label className="cl-field">
                <span className="cl-label">Observações</span>
                <textarea
                  className="cl-input cl-textarea"
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setCampo('observacoes', e.target.value)}
                  placeholder="Preferências, condições de pagamento, etc."
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
                  'Cadastrar cliente'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
