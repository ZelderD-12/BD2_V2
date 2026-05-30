import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,  // Fuerza este puerto, no busca otro
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://192.168.1.49:8080',
        changeOrigin: true
      }
    }
  }
})