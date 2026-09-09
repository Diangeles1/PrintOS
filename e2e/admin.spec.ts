import { test, expect, request as pwRequest } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

import { E2E } from './usuarios';
import { login } from './_helpers';

function env(k: string): string {
  if (process.env[k]) return process.env[k] as string;
  for (const f of ['.env.local', '.env']) {
    try {
      for (const l of readFileSync(f, 'utf8').split('\n')) {
        const i = l.indexOf('=');
        if (i > 0 && l.slice(0, i).trim() === k) return l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* próximo */
    }
  }
  return '';
}

const admin = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

async function idPorEmail(email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return data.users.find((u) => (u.email || '') === email)?.id ?? '';
}

test.describe('Console SuperADMIN', () => {
  test('lista contas, abre detalhe e registra auditoria', async ({ page }) => {
    await login(page, E2E.admin.email, E2E.admin.senha);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Contas \(/ })).toBeVisible();
    await expect(page.getByText(E2E.fluxo.email)).toBeVisible();

    // abre o detalhe da conta de fluxo
    const linha = page.locator('tbody tr').filter({ hasText: E2E.fluxo.email });
    await linha.getByRole('link', { name: 'Abrir' }).click();
    await expect(page).toHaveURL(/\/admin\/contas\//);
    await expect(page.getByRole('heading', { name: /Ações/i })).toBeVisible();

    // gera link de acesso (ação não destrutiva) e confere a auditoria
    await page.getByRole('button', { name: /Gerar link de acesso/ }).click();
    await expect(page.getByText(/Link gerado|Link de acesso/).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/auditoria');
    await expect(page.getByText('Gerou link de acesso').first()).toBeVisible();
  });

  test('gate do /api/admin/acao: header + sessão + sem sessão', async ({ page, baseURL }) => {
    await login(page, E2E.admin.email, E2E.admin.senha);
    await page.goto('/admin'); // garante sessão nos cookies do contexto

    const alvoId = await idPorEmail(E2E.alvo.email);
    expect(alvoId).toBeTruthy();

    // sessão de admin, SEM o header anti-CSRF → 403
    const semHeader = await page.request.post('/api/admin/acao', {
      data: { acao: 'confirmar_email', userId: alvoId },
    });
    expect(semHeader.status()).toBe(403);

    // sessão de admin, COM header → 200
    const comHeader = await page.request.post('/api/admin/acao', {
      headers: { 'X-PrintOS-Admin': '1' },
      data: { acao: 'confirmar_email', userId: alvoId },
    });
    expect(comHeader.status()).toBe(200);

    // admin não bane a si mesmo
    const adminId = await idPorEmail(E2E.admin.email);
    const auto = await page.request.post('/api/admin/acao', {
      headers: { 'X-PrintOS-Admin': '1' },
      data: { acao: 'banir', userId: adminId },
    });
    expect(auto.status()).toBe(400);

    // contexto SEM sessão (sem cookies) → nunca executa, mesmo com header
    const anon = await pwRequest.newContext({ baseURL });
    const semSessao = await anon.post('/api/admin/acao', {
      headers: { 'X-PrintOS-Admin': '1' },
      data: { acao: 'banir', userId: alvoId },
      maxRedirects: 0,
    });
    expect([307, 401, 403]).toContain(semSessao.status());
    await anon.dispose();
  });

  test('vazamento de contexto sob concorrência: request sem sessão não vira admin', async ({
    page,
    baseURL,
  }) => {
    await login(page, E2E.admin.email, E2E.admin.senha);
    const alvoId = await idPorEmail(E2E.alvo.email);
    const anon = await pwRequest.newContext({ baseURL });

    let vazou = 0;
    for (let rodada = 0; rodada < 6; rodada++) {
      const lote: Promise<unknown>[] = [];
      for (let i = 0; i < 12; i++) {
        // tráfego autenticado (admin navegando)
        lote.push(page.request.get('/dashboard'));
        // enxurrada sem sessão tentando banir
        lote.push(
          anon
            .post('/api/admin/acao', {
              headers: { 'X-PrintOS-Admin': '1' },
              data: { acao: 'banir', userId: alvoId },
              maxRedirects: 0,
            })
            .then((r) => {
              if (r.status() === 200) vazou++;
            }),
        );
      }
      await Promise.all(lote);
    }
    expect(vazou, 'requests sem sessão que conseguiram banir').toBe(0);

    const { data } = await admin.auth.admin.getUserById(alvoId);
    const banido = !!data.user?.banned_until && new Date(data.user.banned_until) > new Date();
    expect(banido, 'e2e-alvo acabou banido').toBe(false);

    await anon.dispose();
  });

  test('não-admin não acessa /admin nem a RPC/auditoria', async ({ page }) => {
    await login(page, E2E.fluxo.email, E2E.fluxo.senha);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/); // middleware chuta pra fora

    // RPC e tabela de auditoria bloqueadas pra usuário comum
    const anon = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
      auth: { persistSession: false },
    });
    await anon.auth.signInWithPassword({ email: E2E.fluxo.email, password: E2E.fluxo.senha });
    const rpc = await anon.rpc('admin_resumo_contas');
    expect(rpc.error).toBeTruthy();
    const aud = await anon.from('admin_audit').select('id').limit(1);
    expect(aud.error || (aud.data?.length ?? 0) === 0).toBeTruthy();
  });
});
