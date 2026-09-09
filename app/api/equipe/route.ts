import { getPapel } from '@/lib/equipe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function graficaDoDono() {
  if ((await getPapel()) !== 'dono') return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// POST { email, nome } → adiciona funcionário à gráfica do dono logado.
export async function POST(request: Request) {
  const grafica = await graficaDoDono();
  if (!grafica) return j({ erro: 'apenas o dono pode gerenciar a equipe' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return j({ erro: 'json inválido' }, 400);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const nome = typeof body.nome === 'string' ? body.nome.trim().slice(0, 80) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return j({ erro: 'e-mail inválido' }, 400);

  const admin = createAdminClient();

  // acha ou cria o usuário
  let userId: string | null = null;
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  userId = lista.users.find((u) => (u.email || '').toLowerCase() === email)?.id ?? null;
  let criado = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: nome || email.split('@')[0], papel: 'funcionario' },
    });
    if (error) return j({ erro: `não foi possível criar o acesso: ${error.message}` }, 400);
    userId = data.user.id;
    criado = true;
  }
  if (userId === grafica) return j({ erro: 'esse e-mail é o do dono' }, 400);

  // já é funcionário de alguém?
  const { data: jaAtivo } = await admin
    .from('grafica_membros')
    .select('grafica_id')
    .eq('membro_id', userId)
    .eq('ativo', true)
    .maybeSingle();
  if (jaAtivo && jaAtivo.grafica_id !== grafica) {
    return j({ erro: 'esse usuário já faz parte de outra gráfica' }, 409);
  }

  // desativa vínculos antigos e (re)ativa o desta gráfica
  await admin.from('grafica_membros').update({ ativo: false }).eq('membro_id', userId);
  const { error: eUp } = await admin
    .from('grafica_membros')
    .upsert(
      { grafica_id: grafica, membro_id: userId, papel: 'funcionario', nome, ativo: true },
      { onConflict: 'grafica_id,membro_id' },
    );
  if (eUp) return j({ erro: eUp.message }, 400);
  await admin.auth.admin.updateUserById(userId, { user_metadata: { papel: 'funcionario', display_name: nome || undefined } });

  // link de acesso pra mandar pra pessoa
  const { data: link } = await admin.auth.admin.generateLink({ type: criado ? 'invite' : 'magiclink', email });
  return j({
    ok: true,
    msg: criado ? 'Acesso criado. Envie o link para a pessoa entrar e definir a senha.' : 'Funcionário adicionado. Envie o link de acesso.',
    link: link?.properties?.action_link,
  });
}

// DELETE ?id=<grafica_membros.id> → tira o funcionário.
export async function DELETE(request: Request) {
  const grafica = await graficaDoDono();
  if (!grafica) return j({ erro: 'apenas o dono pode gerenciar a equipe' }, 403);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return j({ erro: 'id ausente' }, 400);

  const admin = createAdminClient();
  const { data: m } = await admin
    .from('grafica_membros')
    .select('id, grafica_id, membro_id, papel')
    .eq('id', id)
    .maybeSingle();
  if (!m || m.grafica_id !== grafica) return j({ erro: 'membro não encontrado' }, 404);
  if (m.papel === 'dono') return j({ erro: 'não dá pra remover o dono' }, 400);

  await admin.from('grafica_membros').delete().eq('id', id);
  await admin.auth.admin.updateUserById(m.membro_id, { user_metadata: { papel: null } });
  return j({ ok: true, msg: 'Funcionário removido.' });
}
