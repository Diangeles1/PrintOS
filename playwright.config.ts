import { defineConfig, devices } from '@playwright/test';

// Alvo dos testes E2E. Em local, aponte para o servidor que estiver no ar
// (dev :3000 ou `next start` :3100). No CI, o webServer abaixo sobe sozinho.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // O servidor (dev :3000 ou `next start` :3100) deve estar no ar antes.
  // Local:  npx next start -p 3100  →  npm run e2e
  // CI:     ver .github/workflows/ci.yml
});
