import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import PrintButton from './PrintButton';

const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : null;

const STATUS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

type Item = {
  id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

export default async function ImprimirOrcamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: orc }, { data: itens }, { data: empresa }, { data: userRes }] =
    await Promise.all([
      supabase.from('orcamentos').select('*').eq('id', id).maybeSingle(),
      supabase.from('orcamento_itens').select('*').eq('orcamento_id', id).order('ordem'),
      supabase.from('empresa').select('*').maybeSingle(),
      supabase.auth.getUser(),
    ]);

  if (!orc) notFound();

  const md = (userRes.user?.user_metadata ?? {}) as Record<string, unknown>;
  const nome =
    empresa?.nome ||
    (typeof md.company_name === 'string' && md.company_name) ||
    (typeof md.display_name === 'string' && md.display_name) ||
    'Orçamento';
  const contato = [empresa?.documento, empresa?.telefone, empresa?.endereco]
    .filter(Boolean)
    .join(' · ');
  const logo = empresa?.logo_url as string | null;

  const lista = (itens as Item[] | null) ?? [];
  const criadoEm = dataBR(orc.created_at as string);
  const validade = dataBR(orc.validade as string | null);

  return (
    <div className="doc-wrap">
      <PrintButton voltarHref={`/orcamentos/${id}`} />

      <div className="doc">
        <header className="doc-head">
          <div className="doc-head-left">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="doc-logo" src={logo} alt={nome} />
            ) : (
              <p className="doc-empresa">{nome}</p>
            )}
            {logo && <p className="doc-empresa doc-empresa--sm">{nome}</p>}
            {contato && <p className="doc-sub">{contato}</p>}
          </div>
          <div className="doc-head-right">
            <p className="doc-kicker">Orçamento</p>
            <p className="doc-num">Nº {orc.numero}</p>
            <p className="doc-sub">Emissão: {criadoEm}</p>
            {validade && <p className="doc-sub">Válido até: {validade}</p>}
            <p className="doc-sub">Situação: {STATUS[orc.status as string] ?? orc.status}</p>
          </div>
        </header>

        <section className="doc-cliente">
          <span className="doc-label">Cliente</span>
          <strong>{(orc.cliente_nome as string) || 'Não informado'}</strong>
        </section>

        <table className="doc-tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="doc-r">Qtd.</th>
              <th className="doc-r">Preço un.</th>
              <th className="doc-r">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id}>
                <td>{i.descricao}</td>
                <td className="doc-r">
                  {Number(i.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                </td>
                <td className="doc-r">{brl(Number(i.preco_unitario))}</td>
                <td className="doc-r">{brl(Number(i.subtotal))}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="doc-vazio">
                  Sem itens.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="doc-totais">
          <div>
            <span>Subtotal</span>
            <span>{brl(Number(orc.subtotal))}</span>
          </div>
          {Number(orc.desconto) > 0 && (
            <div>
              <span>Desconto</span>
              <span>- {brl(Number(orc.desconto))}</span>
            </div>
          )}
          <div className="doc-total">
            <span>Total</span>
            <span>{brl(Number(orc.total))}</span>
          </div>
        </div>

        {orc.observacoes ? (
          <section className="doc-obs">
            <span className="doc-label">Condições</span>
            <p>{orc.observacoes as string}</p>
          </section>
        ) : null}

        <footer className="doc-foot">
          <span>{nome} · {criadoEm}</span>
          <span className="doc-badge">
            <span className="doc-badge-wm">
              Print<b>OS</b>
            </span>
            <i aria-hidden="true" />
          </span>
        </footer>
      </div>
    </div>
  );
}
