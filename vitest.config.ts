import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: unit/integration tests don't need the TanStack Start/Nitro plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // The first test in a file also migrates and seeds the PGlite template (test-db.ts), ~5 s on CI.
  test: { include: ['src/**/*.test.ts'], environment: 'node', testTimeout: 20_000 },
})
