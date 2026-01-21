import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,  // 允许局域网访问
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/local-file': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
