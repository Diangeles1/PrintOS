import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { requireSuperadmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';

import ContaAcoes from './ContaAcoes';

export const dynamic = 'force-dynamic';

const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function AdminContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { email: adminEmail } = await requireSuperadmin();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: uRes, error: uErr } = await admin.auth.admin.getUserById(id);
  if (uErr || !uRes?.user) notFound();
  const u = uRes.user;

  const [empresa, pedidos, orcamentos, numeros, tokens, aprovacoes, caixaAberto] = await Promise.all([
    admin.from('empresa').select('*').eq('user_id', id).maybeSingle(),
    admin.from('pedidos').select('id, numero, cliente_nome, status, total, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(8),
    admin.from('orcamentos').select('id, numero, cliente_nome, status, total, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(6),
    admin.from('whatsapp_numeros').select('id', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('ingest_tokens').select('id', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('pedido_aprovacoes').select('id', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('caixa_sessoes').select('id, aberto_em').eq('user_id', id).eq('status', 'aberto').maybeSingle(),
  ]);

  const md = (u.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = typeof md.display_name === 'string' ? md.display_name : '';
  const banido = !!u.banned_until && new Date(u.banned_until) > new Date();
  const emp = empresa.data as Record<string, unknown> | null;

  return (
    <div className="adm-page">
      <Link href="/admin" className="adm-voltar">
        <ArrowLeft size={15} aria-hidden="true" /> Contas
      </Link>

      <header className="adm-head">
        <h1>{(emp?.nome as string) || displayName || u.email}</h1>
        <p>
          {u.email} · <span className="adm-mono">{u.id}</span>
        </p>
      </header>

      <div className="adm-grid2">
        <section className="adm-box">
          <h2>Conta</h2>
          <dl className="adm-dl">
            <div><dt>Estado</dt><dd>{banido ? 'Suspensa' : u.email_confirmed_at ? 'Ativa' : 'E-mail não confirmado'}</dd></div>
            <div><dt>Nome exibido</dt><dd>{displayName || '—'}</dd></div>
            <div><dt>Criada em</dt><dd>{dt(u.created_at)}</dd></div>
            <div><dt>Último login</dt><dd>{dt(u.last_sign_in_at)}</dd></div>
            <div><dt>E-mail confirmado</dt><dd>{dt(u.email_confirmed_at)}</dd></div>
            <div><dt>Provedor</dt><dd>{(u.app_metadata?.provider as string) || 'email'}</dd></div>
            {banido && <div><dt>Suspensa até</dt><dd>{dt(u.banned_until)}</dd></div>}
          </dl>
        </section>

        <section className="adm-box">
          <h2>Uso</h2>
          <dl className="adm-dl">
            <div><dt>Pedidos</dt><dd>{pedidos.data?.length ?? 0}{(pedidos.data?.length ?? 0) === 8 ? '+ (8 mais recentes)' : ''}</dd></div>
            <div><dt>Orçamentos</dt><dd>{orcamentos.data?.length ?? 0}</dd></div>
            <div><dt>Números WhatsApp</dt><dd>{numeros.count ?? 0}</dd></div>
            <div><dt>Tokens de extensão</dt><dd>{tokens.count ?? 0}</dd></div>
            <div><dt>Links de aprovação</dt><dd>{aprovacoes.count ?? 0}</dd></div>
            <div><dt>Caixa aberto</dt><dd>{caixaAberto.data ? `sim (desde ${dt(caixaAberto.data.aberto_em)})` : 'não'}</dd></div>
          </dl>
        </section>
      </div>

      <ContaAcoes
        userId={u.id}
        email={u.email ?? ''}
        ehProprio={(u.email ?? '').toLowerCase() === adminEmail.toLowerCase()}
        banido={banido}
        emailConfirmado={!!u.email_confirmed_at}
        displayName={displayName}
        empresa={{
          nome: (emp?.nome as string) ?? '',
          documento: (emp?.documento as string) ?? '',
          telefone: (emp?.telefone as string) ?? '',
          endereco: (emp?.endereco as string) ?? '',
        }}
      />

      <section className="adm-box">
        <h2>Últimos pedidos</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Nº</th><th>Cliente</th><th>Status</th><th className="adm-num">Total</th><th>Criado</th></tr>
            </thead>
            <tbody>
              {(pedidos.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>#{p.numero}</td>
                  <td>{p.cliente_nome || '—'}</td>
                  <td>{p.status}</td>
                  <td className="adm-num">{brl(Number(p.total))}</td>
                  <td>{dt(p.created_at)}</td>
                </tr>
              ))}
              {(pedidos.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="adm-vazio">Nenhum pedido.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
