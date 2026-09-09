'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type ServicoVenda = {
  id: string;
  nome: string;
  categoria: string | null;
  preco: number;
  unidade: string;
};

type ItemCarrinho = {
  servico_id: string;
  descricao: string;
  preco: number;
  qtd: number;
};

const PAGAMENTOS: { valor: string; label: string }[] = [
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'pix', label: 'PIX' },
  { valor: 'debito', label: 'Débito' },
  { valor: 'credito', label: 'Crédito' },
];

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const brlFn = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VendaRapida({
  servicos,
  caixaAberto,
  erroCarregar,
  papel = 'dono',
  meuTotalHoje = 0,
  meuQtdHoje = 0,
}: {
  servicos: ServicoVenda[];
  caixaAberto: boolean;
  erroCarregar: string | null;
  papel?: 'dono' | 'funcionario';
  meuTotalHoje?: number;
  meuQtdHoje?: number;
}) {
  const ehFuncionario = papel === 'funcionario';
  const router = useRouter();
  const supabase = createClient();

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [painel, setPainel] = useState(false);
  const [pagamento, setPagamento] = useState('dinheiro');
  const [clienteNome, setClienteNome] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const total = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco * i.qtd, 0),
    [carrinho],
  );

  function adicionar(s: ServicoVenda) {
    setSucesso(null);
    setCarrinho((c) => {
      const ix = c.findIndex((i) => i.servico_id === s.id);
      if (ix >= 0) {
        const cp = [...c];
        cp[ix] = { ...cp[ix], qtd: cp[ix].qtd + 1 };
        return cp;
      }
      return [...c, { servico_id: s.id, descricao: s.nome, preco: Number(s.preco), qtd: 1 }];
    });
  }

  function ajustar(servico_id: string, delta: number) {
    setCarrinho((c) =>
      c
        .map((i) => (i.servico_id === servico_id ? { ...i, qtd: i.qtd + delta } : i))
        .filter((i) => i.qtd > 0),
    );
  }

  function remover(servico_id: string) {
    setCarrinho((c) => c.filter((i) => i.servico_id !== servico_id));
  }

  function limpar() {
    setCarrinho([]);
    setPainel(false);
    setErro(null);
  }

  async function finalizar(e: FormEvent) {
    e.preventDefault();
    if (carrinho.length === 0) return;
    setErro(null);
    setFinalizando(true);

    const { data: pedido, error: e1 } = await supabase
      .from('pedidos')
      .insert({
        status: 'entregue',
        cliente_nome: clienteNome.trim() || 'Venda balcão',
        forma_pagamento: pagamento,
      })
      .select('id, numero')
      .single();
    if (e1 || !pedido) {
      setFinalizando(false);
      setErro(`Não foi possível registrar a venda. ${e1?.message ?? ''}`);
      return;
    }

    const itens = carrinho.map((i, idx) => ({
      pedido_id: pedido.id,
      servico_id: i.servico_id,
      descricao: i.descricao,
      quantidade: i.qtd,
      preco_unitario: i.preco,
      ordem: idx,
    }));
    const { error: e2 } = await supabase.from('pedido_itens').insert(itens);
    if (e2) {
      setFinalizando(false);
      setErro(`Venda criada, mas houve erro nos itens. ${e2.message}`);
      return;
    }

    let avisoCaixa = '';
    if (caixaAberto) {
      const { data: sessao } = await supabase
        .from('caixa_sessoes')
        .select('id')
        .eq('status', 'aberto')
        .limit(1)
        .maybeSingle();
      if (sessao) {
        const { error: e3 } = await supabase.from('caixa_movimentos').insert({
          sessao_id: sessao.id,
          tipo: 'entrada',
          categoria: 'Venda',
          descricao: `Venda rápida · Pedido #${pedido.numero}`,
          valor: total,
        });
        if (e3) avisoCaixa = ' (não foi possível lançar no caixa)';
      } else {
        avisoCaixa = ' (caixa fechou — sem lançamento)';
      }
    } else {
      avisoCaixa = ' · caixa fechado, sem lançamento';
    }

    setFinalizando(false);
    setCarrinho([]);
    setPainel(false);
    setClienteNome('');
    setSucesso(`Venda registrada — Pedido #${pedido.numero}${avisoCaixa}.`);
    router.refresh();
  }

  const categorias = useMemo(() => {
    const map = new Map<string, ServicoVenda[]>();
    for (const s of servicos) {
      const k = s.categoria || 'Outros';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return [...map.entries()];
  }, [servicos]);

  return (
    <div className="page">
      <h1 className="page-title">Venda Rápida</h1>
      <p className="muted">Balcão: toque nos itens, ajuste a quantidade e finalize.</p>

      {erroCarregar && (
        <div className="cl-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar o catálogo.</strong>
            <span>{erroCarregar}</span>
          </div>
        </div>
      )}

      {ehFuncionario && (
        <div className="vr-meudia">
          <span>Minhas vendas hoje</span>
          <strong>{brlFn(meuTotalHoje)}</strong>
          <small>
            {meuQtdHoje} {meuQtdHoje === 1 ? 'venda' : 'vendas'}
          </small>
        </div>
      )}

      {!ehFuncionario && !caixaAberto && !erroCarregar && (
        <div className="cl-banner vr-aviso">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Caixa fechado.</strong>
            <span>A venda é registrada como pedido, mas não entra no caixa. Abra o caixa para lançar.</span>
          </div>
        </div>
      )}

      {sucesso && (
        <p className="login-mensagem" style={{ fontSize: 13, marginTop: 14 }}>
          {sucesso}
        </p>
      )}

      <div className="vr-layout">
        <div className="vr-catalogo">
          {servicos.length === 0 ? (
            <div className="ax-empty">
              <span className="ax-empty-ico" aria-hidden="true">
                <ShoppingCart size={22} strokeWidth={2} />
              </span>
              <p className="ax-empty-title">Catálogo vazio</p>
              <p className="ax-empty-sub">
                Cadastre serviços ativos em <strong>Serviços</strong> para vender aqui.
              </p>
            </div>
          ) : (
            categorias.map(([cat, itens]) => (
              <div className="vr-cat" key={cat}>
                <p className="vr-cat-nome">{cat}</p>
                <div className="vr-grid">
                  {itens.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="vr-tile"
                      onClick={() => adicionar(s)}
                    >
                      <span className="vr-tile-nome">{s.nome}</span>
                      <span className="vr-tile-preco">
                        {brl(Number(s.preco))}
                        <small>/{s.unidade}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <aside className="vr-carrinho">
          <div className="vr-carrinho-head">
            <ShoppingCart size={16} aria-hidden="true" />
            Carrinho
            {carrinho.length > 0 && <span className="vr-badge">{carrinho.length}</span>}
          </div>

          <div className="vr-carrinho-body">
            {carrinho.length === 0 ? (
              <p className="vr-carrinho-vazio">Nenhum item ainda.</p>
            ) : (
              carrinho.map((i) => (
                <div className="vr-linha" key={i.servico_id}>
                  <div className="vr-linha-info">
                    <span className="vr-linha-nome">{i.descricao}</span>
                    <span className="vr-linha-sub">
                      {i.qtd} × {brl(i.preco)} = <strong>{brl(i.qtd * i.preco)}</strong>
                    </span>
                  </div>
                  <div className="vr-linha-qtd">
                    <button type="button" aria-label="Menos" onClick={() => ajustar(i.servico_id, -1)}>
                      <Minus size={13} aria-hidden="true" />
                    </button>
                    <span>{i.qtd}</span>
                    <button type="button" aria-label="Mais" onClick={() => ajustar(i.servico_id, 1)}>
                      <Plus size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="vr-linha-x"
                      aria-label="Remover"
                      onClick={() => remover(i.servico_id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="vr-carrinho-foot">
            <div className="vr-total">
              <span>Total</span>
              <strong>{brl(total)}</strong>
            </div>
            <div className="vr-carrinho-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={limpar}
                disabled={carrinho.length === 0}
              >
                Limpar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPainel(true)}
                disabled={carrinho.length === 0}
              >
                Finalizar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {painel && (
        <div className="cl-overlay" onClick={() => !finalizando && setPainel(false)}>
          <form className="cl-panel" onClick={(e) => e.stopPropagation()} onSubmit={finalizar}>
            <div className="cl-panel-head">
              <h2>Finalizar venda</h2>
              <button type="button" aria-label="Fechar" onClick={() => setPainel(false)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="cl-panel-body">
              <div className="cx-esperado">
                <span>Total da venda</span>
                <strong>{brl(total)}</strong>
              </div>

              <div className="cl-field">
                <span className="cl-label">Forma de pagamento</span>
                <div className="cl-seg vr-seg">
                  {PAGAMENTOS.map((p) => (
                    <button
                      key={p.valor}
                      type="button"
                      className={pagamento === p.valor ? 'is-on' : ''}
                      onClick={() => setPagamento(p.valor)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="cl-field">
                <span className="cl-label">Cliente (opcional)</span>
                <input
                  className="cl-input"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Venda balcão"
                />
              </label>

              {!ehFuncionario && !caixaAberto && (
                <p className="cl-form-err" style={{ color: '#9a5b00' }}>
                  O caixa está fechado — a venda não será lançada nele.
                </p>
              )}
              {erro && <p className="cl-form-err">{erro}</p>}
            </div>

            <div className="cl-panel-foot">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPainel(false)}
                disabled={finalizando}
              >
                Voltar
              </button>
              <button type="submit" className="btn" disabled={finalizando}>
                {finalizando ? (
                  <>
                    <Loader2 size={16} className="cl-spin" aria-hidden="true" />
                    Registrando…
                  </>
                ) : (
                  `Confirmar ${brl(total)}`
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
