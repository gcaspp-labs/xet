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
    // O node_modules deste worktree é symlink para o do frontend principal, fora da
    // pasta: sem liberar o destino, as fontes e os logos do design system dão 403.
    fs: {
      allow: [import.meta.dirname, path.resolve(import.meta.dirname, '../../..')],
    },
    proxy: {
      // ws repassa o WebSocket do painel; o Host original é mantido para a
      // verificação de origem do backend.
      '/api': { target: backendURL, ws: true, changeOrigin: false },
      '/health': backendURL,
    },
  },
})
