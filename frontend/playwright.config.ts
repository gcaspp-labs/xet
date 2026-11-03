import { defineConfig, devices } from '@playwright/test'

// Portas próprias para não colidir com servidores de desenvolvimento.
const backendPort = 18080
const frontendPort = 15173
const cnpjApiPort = 18081

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Microfone simulado (um tom contínuo) para a gravação de áudio, sem pedir permissão.
        permissions: ['microphone'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
  ],
  webServer: [
    {
      // API de CNPJ falsa: os testes nunca chamam o serviço real.
      command: 'node e2e/fake-cnpj-api.mjs',
      url: `http://localhost:${cnpjApiPort}/health`,
      env: { PORT: String(cnpjApiPort) },
    },
    {
      command: 'go run ./cmd/server',
      cwd: '../backend',
      url: `http://localhost:${backendPort}/health`,
      env: {
        HTTP_ADDR: `:${backendPort}`,
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        COOKIE_SECURE: 'false',
        // WhatsApp simulado; as rotas /api/test/messaging controlam o celular falso.
        MESSAGING_PROVIDER: 'fake',
        CNPJ_API_URL: `http://localhost:${cnpjApiPort}/cnpj`,
      },
    },
    {
      // Build de produção servido pelo vite preview (com o mesmo proxy de /api):
      // o servidor de desenvolvimento compila cada módulo no primeiro acesso, e
      // com vários navegadores em paralelo e o cache vazio (como no CI) os
      // primeiros carregamentos estouravam os tempos de espera dos testes.
      command: `npx vite build --logLevel warn && npx vite preview --port ${frontendPort} --strictPort`,
      url: `http://localhost:${frontendPort}`,
      timeout: 120_000,
      env: { BACKEND_URL: `http://localhost:${backendPort}` },
    },
  ],
})
