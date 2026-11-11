import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // One client bundle instead of a chunk per route: after any visit the service worker has all
  // the code, so pages never opened before still work offline (whole app is ~0.5 MB).
  environments: { client: { build: { rolldownOptions: { output: { codeSplitting: false } } } } },
  plugins: [
    // PGlite loads its .wasm/.data files from its own package dir, so ship it unbundled.
    nitro({ traceDeps: ['@electric-sql/pglite*'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
