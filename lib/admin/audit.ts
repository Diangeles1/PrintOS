import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditEntrada = {
  actor: string;
  acao: string;
  alvoId?: string | null;
  alvoEmail?: string | null;
  detalhe?: Record<string, unknown>;
};

/** Grava uma linha em admin_audit. Recebe o client service_role (admin). */
export async function registrarAudit(admin: SupabaseClient, e: AuditEntrada) {
  try {
    await admin.from('admin_audit').insert({
      actor_email: e.actor,
      acao: e.acao,
      alvo_user_id: e.alvoId ?? null,
      alvo_email: e.alvoEmail ?? null,
      detalhe: e.detalhe ?? {},
    });
  } catch (err) {
    // auditoria não deve derrubar a ação, mas registra no log do servidor
    console.error('[admin_audit] falha ao registrar:', err);
  }
}
