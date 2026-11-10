import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: unit/integration tests don't need the TanStack Start/Nitro plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
