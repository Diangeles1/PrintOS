import { test, expect } from '@playwright/test';

import { E2E } from './usuarios';
import { login } from './_helpers';

test('fluxo: login → cliente → orçamento → aprovar → pedido → produção', async ({ page }) => {
  const marca = Date.now().toString().slice(-6);

  // --- login ---
  await login(page, E2E.fluxo.email, E2E.fluxo.senha);
  await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();

  // --- cadastra um cliente ---
  await page.goto('/clientes');
  await page.getByRole('button', { name: /Novo cliente/ }).click();
  const nomeCliente = `Cliente E2E ${marca}`;
  await page.getByPlaceholder('Nome do cliente ou empresa').fill(nomeCliente);
  await page.locator('form.cl-panel button[type="submit"]').click();
  await expect(page.getByRole('cell', { name: nomeCliente, exact: true })).toBeVisible({ timeout: 15_000 });

  // --- novo orçamento (abre o editor já com um rascunho) ---
  await page.goto('/orcamentos');
  await page.getByRole('button', { name: /Novo orçamento/ }).click();
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/, { timeout: 20_000 });

  // item livre + preço → total sobe
  await page.getByRole('button', { name: /Item livre/ }).click();
  const linha = page.locator('table tbody tr').first();
  await linha.locator('input.oc-cell').first().fill('Cartão de visita E2E');
  await linha.locator('input.oc-cell--num').nth(0).fill('100');
  await linha.locator('input.oc-cell--num').nth(1).fill('0.5');
  await expect(page.getByText('R$ 50,00').first()).toBeVisible();

  // aprova e gera pedido
  await page.getByRole('button', { name: 'Aprovado', exact: true }).click();
  await expect(page.getByRole('button', { name: /Gerar pedido/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Gerar pedido/ }).click();
  await page.waitForURL(/\/pedidos\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Pedido #\d+/ })).toBeVisible();

  // --- produção: o board renderiza com o pedido novo ---
  await page.goto('/producao');
  await expect(page.getByText(/Aguardando arte/i).first()).toBeVisible();
});
