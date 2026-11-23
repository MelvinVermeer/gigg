import { defineConfig, devices } from '@playwright/test'

const port = 3100

// Runs against a production build in local mode (PGlite + seed, emails to .outbox.jsonl).
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: devices['Desktop Chrome'], dependencies: ['setup'] },
  ],
  webServer: {
    command: 'rm -rf .pglite-e2e .outbox.jsonl && pnpm build && node .output/server/index.mjs',
    url: `http://localhost:${port}`,
    env: { PORT: String(port), PGLITE_DIR: '.pglite-e2e', BETTER_AUTH_URL: `http://localhost:${port}`, OPEN_SIGNUP: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
