import { defineConfig, devices } from '@playwright/test'

// Portas próprias para não colidir com servidores de desenvolvimento.
const backendPort = 18080
const frontendPort = 15173

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: '../backend',
      url: `http://localhost:${backendPort}/health`,
      env: {
        HTTP_ADDR: `:${backendPort}`,
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        COOKIE_SECURE: 'false',
      },
    },
    {
      command: `npm run dev -- --port ${frontendPort} --strictPort`,
      url: `http://localhost:${frontendPort}`,
      env: { BACKEND_URL: `http://localhost:${backendPort}` },
    },
  ],
})
