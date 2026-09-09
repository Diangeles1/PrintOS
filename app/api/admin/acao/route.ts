import { getSuperadmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrarAudit } from '@/lib/admin/audit';

export const runtime = 'nodejs';

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const txt = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null;

export async function POST(request: Request) {
  // Defesa em profundidade (CSRF + isolamento):
  // 1) exige um header custom que só as páginas do /admin mandam. Uma
  //    requisição cross-site não consegue setar esse header sem preflight
  //    CORS (que não damos), e uma chamada de fora do navegador simplesmente
  //    não o inclui.
  if (request.headers.get('x-printos-admin') !== '1') {
    return j({ erro: 'requisição inválida' }, 403);
  }
  // 2) se vier Origin, o host dele tem que bater com o Host da requisição
  //    (same-origin). Independe de porta/domínio de deploy.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      return j({ erro: 'origem inválida' }, 403);
    }
    if (host && originHost !== host) {
      return j({ erro: 'origem não permitida' }, 403);
    }
  }
  // 3) e, claro, a sessão precisa ser de um SuperADMIN.
  const sa = await getSuperadmin();
  if (!sa) return j({ erro: 'não autorizado' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return j({ erro: 'json inválido' }, 400);
  }

  const acao = String(body.acao ?? '');
  const userId = String(body.userId ?? '');
  if (!/^[0-9a-f-]{36}$/.test(userId)) return j({ erro: 'userId inválido' }, 400);

  const admin = createAdminClient();
  const { data: alvoRes, error: eAlvo } = await admin.auth.admin.getUserById(userId);
  if (eAlvo || !alvoRes?.user) return j({ erro: 'conta não encontrada' }, 404);
  const alvo = alvoRes.user;
  const alvoEmail = alvo.email ?? '';

  const seMesmo = alvoEmail.toLowerCase() === sa.email.toLowerCase();
  const audit = (detalhe: Record<string, unknown> = {}) =>
    registrarAudit(admin, { actor: sa.email, acao, alvoId: userId, alvoEmail, detalhe });

  try {
    switch (acao) {
      case 'banir': {
        if (seMesmo) return j({ erro: 'você não pode suspender a própria conta' }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '87600h' });
        if (error) return j({ erro: error.message }, 400);
        await audit();
        return j({ ok: true, msg: 'Acesso suspenso.' });
      }
      case 'desbanir': {
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
        if (error) return j({ erro: error.message }, 400);
        await audit();
        return j({ ok: true, msg: 'Acesso reativado.' });
      }
      case 'confirmar_email': {
        const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
        if (error) return j({ erro: error.message }, 400);
        await audit();
        return j({ ok: true, msg: 'E-mail confirmado.' });
      }
      case 'reset_senha':
      case 'magiclink': {
        const tipo = acao === 'reset_senha' ? 'recovery' : 'magiclink';
        const { data, error } = await admin.auth.admin.generateLink({
          type: tipo as 'recovery' | 'magiclink',
          email: alvoEmail,
        });
        if (error) return j({ erro: error.message }, 400);
        await audit({ tipo });
        return j({
          ok: true,
          msg: 'Link gerado. Copie e envie para a pessoa (uso único).',
          link: data.properties?.action_link,
          linkRotulo: tipo === 'recovery' ? 'Link de redefinição de senha' : 'Link de acesso',
        });
      }
      case 'salvar_nome': {
        const nome = txt(body.displayName, 60);
        const meta = { ...(alvo.user_metadata ?? {}), display_name: nome ?? '' };
        const { error } = await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
        if (error) return j({ erro: error.message }, 400);
        await audit({ display_name: nome });
        return j({ ok: true, msg: 'Nome atualizado.' });
      }
      case 'salvar_empresa': {
        const e = (body.empresa ?? {}) as Record<string, unknown>;
        const registro = {
          user_id: userId,
          nome: txt(e.nome, 120),
          documento: txt(e.documento, 40),
          telefone: txt(e.telefone, 40),
          endereco: txt(e.endereco, 200),
        };
        const { error } = await admin.from('empresa').upsert(registro);
        if (error) return j({ erro: error.message }, 400);
        await audit({ empresa: registro });
        return j({ ok: true, msg: 'Dados da empresa salvos.' });
      }
      case 'apagar_conta': {
        if (seMesmo) return j({ erro: 'você não pode apagar a própria conta por aqui' }, 400);
        if (txt(body.confirmacao, 200)?.toLowerCase() !== alvoEmail.toLowerCase()) {
          return j({ erro: 'confirmação não confere' }, 400);
        }
        await audit({ apagou: alvoEmail });
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return j({ erro: error.message }, 400);
        return j({ ok: true, msg: 'Conta apagada.' });
      }
      default:
        return j({ erro: 'ação desconhecida' }, 400);
    }
  } catch (err) {
    return j({ erro: err instanceof Error ? err.message : 'erro interno' }, 500);
  }
}
