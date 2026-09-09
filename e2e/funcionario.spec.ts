import { test, expect } from '@playwright/test';
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
const id = async (email: string) =>
  (await admin.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users.find(
    (u) => (u.email || '') === email,
  )?.id ?? '';

test.describe('Funcionário', () => {
  test.beforeAll(async () => {
    const dono = await id(E2E.fluxo.email);
    const func = await id(E2E.alvo.email);
    await admin.from('grafica_membros').update({ ativo: false }).eq('membro_id', func);
    await admin.from('grafica_membros').upsert(
      { grafica_id: dono, membro_id: func, papel: 'funcionario', nome: 'Balcão E2E', ativo: true },
      { onConflict: 'grafica_id,membro_id' },
    );
    await admin.auth.admin.updateUserById(func, { user_metadata: { papel: 'funcionario', display_name: 'Balcão E2E' } });
  });

  test.afterAll(async () => {
    // devolve o e2e-alvo pro estado de dono da própria gráfica
    const func = await id(E2E.alvo.email);
    await admin.from('grafica_membros').delete().eq('membro_id', func).eq('papel', 'funcionario');
    await admin.from('grafica_membros').update({ ativo: true }).eq('membro_id', func).eq('papel', 'dono');
    await admin.auth.admin.updateUserById(func, { user_metadata: { papel: null } });
  });

  test('vê só venda/cadastros, não vê caixa nem config, e tem o total do dia', async ({ page }) => {
    await login(page, E2E.alvo.email, E2E.alvo.senha);

    // cai na venda rápida
    await expect(page).toHaveURL(/\/venda-rapida/);
    await expect(page.getByText('Minhas vendas hoje')).toBeVisible();

    // sidebar: sem Caixa / Orçamentos / Configurações / Dashboard
    const nav = page.locator('.ax-sidebar');
    await expect(nav.getByRole('link', { name: 'Venda Rápida' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Clientes' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Serviços' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Caixa' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Orçamentos' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Configurações' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

    // rotas de dono são bloqueadas (redireciona pra venda-rápida)
    for (const rota of ['/caixa', '/configuracoes', '/orcamentos', '/pedidos', '/dashboard']) {
      await page.goto(rota);
      await expect(page, `bloqueio de ${rota}`).toHaveURL(/\/venda-rapida/);
    }

    // pode cadastrar produto
    await page.goto('/servicos');
    await expect(page).toHaveURL(/\/servicos/);
    await expect(page.getByRole('heading', { name: /Serviços/ })).toBeVisible();
  });
});
