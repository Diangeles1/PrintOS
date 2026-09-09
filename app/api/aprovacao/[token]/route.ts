import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const DECISOES = new Set(['aprovado', 'recusado', 'alteracao']);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9]{32,80}$/.test(token)) {
    return json({ erro: 'link inválido' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ erro: 'json inválido' }, 400);
  }

  const decisao = String(body.decisao ?? '');
  if (!DECISOES.has(decisao)) {
    return json({ erro: 'decisão inválida' }, 400);
  }

  const comentario =
    typeof body.comentario === 'string' ? body.comentario.trim().slice(0, 2000) : '';
  const respondente =
    typeof body.respondente === 'string' ? body.respondente.trim().slice(0, 120) : '';

  if (decisao !== 'aprovado' && comentario.length < 3) {
    return json({ erro: 'descreva o que precisa mudar' }, 400);
  }

  const admin = createAdminClient();

  const { data: aprov } = await admin
    .from('pedido_aprovacoes')
    .select('id, pedido_id, status, revogado, expira_em')
    .eq('token', token)
    .maybeSingle();

  if (!aprov || aprov.revogado || new Date(aprov.expira_em as string) < new Date()) {
    return json({ erro: 'link expirado ou inválido' }, 404);
  }
  if (aprov.status !== 'pendente') {
    return json({ erro: 'esse link já foi respondido' }, 409);
  }

  // grava a resposta — o filtro por status='pendente' evita corrida de duplo clique
  const { data: upd, error } = await admin
    .from('pedido_aprovacoes')
    .update({
      status: decisao,
      comentario: comentario || null,
      respondente: respondente || null,
      respondido_em: new Date().toISOString(),
    })
    .eq('id', aprov.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();

  if (error || !upd) {
    return json({ erro: 'não foi possível registrar a resposta' }, 409);
  }

  // arte aprovada → adianta o pedido pra produção (só se ainda estiver aguardando arte)
  if (decisao === 'aprovado') {
    await admin
      .from('pedidos')
      .update({ status: 'em_producao' })
      .eq('id', aprov.pedido_id)
      .eq('status', 'aguardando_arte');
  }

  return json({ ok: true, status: decisao }, 200);
}
