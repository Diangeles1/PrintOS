import { type Page, expect } from '@playwright/test';

export async function login(page: Page, email: string, senha: string) {
  await page.goto('/login');
  await page.getByPlaceholder('seu@e-mail.com').fill(email);
  await page.getByPlaceholder('Digite sua senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(/\/(dashboard|venda-rapida|boas-vindas)/, { timeout: 20_000 });
  // se cair em boas-vindas (sem display_name), resolve
  if (page.url().includes('/boas-vindas')) {
    await page.getByRole('textbox').first().fill('Teste E2E');
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
