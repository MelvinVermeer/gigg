import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // PGlite loads its .wasm/.data files from its own package dir, so ship it unbundled.
    nitro({ traceDeps: ['@electric-sql/pglite*'] }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
