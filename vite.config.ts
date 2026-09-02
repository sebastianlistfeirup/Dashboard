import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// Two builds from one source:
//  - default        → GitHub Pages, fetches ./data/dashboard.json at runtime
//  - VITE_SINGLE_FILE → one self-contained .html with the data compiled in
const singleFile = process.env.VITE_SINGLE_FILE === '1'

export default defineConfig({
  base: singleFile ? './' : (process.env.VITE_BASE ?? '/Dashboard/'),
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    emptyOutDir: true,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
  },
})
