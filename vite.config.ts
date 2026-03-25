import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist-frontend',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:3777',
      '/health': 'http://127.0.0.1:3777',
      '/avatars': 'http://127.0.0.1:3777',
    },
  },
  css: {
    postcss: './postcss.config.mjs',
  },
})
