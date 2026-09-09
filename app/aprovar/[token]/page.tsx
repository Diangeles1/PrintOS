import type { Metadata } from 'next';

import { createAdminClient } from '@/lib/supabase/admin';

import AprovacaoView, { type ArteArquivo } from './AprovacaoView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Aprovação de arte',
  robots: { index: false, follow: false },
};

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="apv-root">
      <div className="apv-card apv-card--aviso">
        <div className="apv-aviso-ico" aria-hidden="true">
          !
        </div>
        <h1>{titulo}</h1>
        <p>{texto}</p>
      </div>
    </div>
  );
}

export default async function AprovarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!/^[a-f0-9]{32,80}$/.test(token)) {
    return <Aviso titulo="Link inválido" texto="Confira se você copiou o endereço completo." />;
  }

  const admin = createAdminClient();

  const { data: aprov } = await admin
    .from('pedido_aprovacoes')
    .select('id, pedido_id, user_id, status, comentario, respondente, respondido_em, revogado, expira_em')
    .eq('token', token)
    .maybeSingle();

  if (!aprov || aprov.revogado || new Date(aprov.expira_em as string) < new Date()) {
    return (
      <Aviso
        titulo="Link indisponível"
        texto="Esse link de aprovação expirou ou foi cancelado pela gráfica. Peça um novo."
      />
    );
  }

  const [{ data: pedido }, { data: empresa }, { data: arqs }] = await Promise.all([
    admin.from('pedidos').select('numero, cliente_nome').eq('id', aprov.pedido_id).maybeSingle(),
    admin.from('empresa').select('nome, logo_url').eq('user_id', aprov.user_id).maybeSingle(),
    admin
      .from('pedido_arquivos')
      .select('id, path, nome, mime')
      .eq('pedido_id', aprov.pedido_id)
      .order('created_at'),
  ]);

  const arquivos: ArteArquivo[] = [];
  for (const a of (arqs as { id: string; path: string; nome: string | null; mime: string | null }[] | null) ??
    []) {
    const { data: signed } = await admin.storage
      .from('pedido-arquivos')
      .createSignedUrl(a.path, 3600);
    arquivos.push({
      id: a.id,
      nome: a.nome ?? 'arte',
      mime: a.mime ?? '',
      url: signed?.signedUrl ?? null,
    });
  }

  return (
    <AprovacaoView
      token={token}
      empresaNome={empresa?.nome ?? 'Gráfica'}
      empresaLogo={empresa?.logo_url ?? null}
      pedidoNumero={pedido?.numero ?? null}
      clienteNome={pedido?.cliente_nome ?? null}
      arquivos={arquivos}
      statusInicial={aprov.status as 'pendente' | 'aprovado' | 'recusado' | 'alteracao'}
      comentario={aprov.comentario as string | null}
      respondente={aprov.respondente as string | null}
      respondidoEm={aprov.respondido_em as string | null}
    />
  );
}
