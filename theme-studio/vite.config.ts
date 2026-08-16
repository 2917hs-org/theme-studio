import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // monaco-editor's package.json `exports` map doesn't resolve this
      // deep subpath reliably through Rolldown's bundler-side resolver
      // (works for the root package entry, fails for this one) — an
      // explicit alias sidesteps package-exports resolution entirely.
      // See src/textmate/monacoInstance.ts for why we use this lean path
      // instead of the full `monaco-editor` root (bundle size).
      'monaco-editor/esm/vs/editor/editor.api.js': fileURLToPath(
        new URL('./node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url),
      ),
    },
  },
})
