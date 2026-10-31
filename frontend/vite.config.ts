import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backendURL = process.env.BACKEND_URL ?? 'http://localhost:8090'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Permite abrir o servidor de desenvolvimento pelo nome MagicDNS do Tailscale.
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': backendURL,
      '/health': backendURL,
    },
  },
})
