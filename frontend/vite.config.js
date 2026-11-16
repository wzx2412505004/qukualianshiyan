import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/peers': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/blocks': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/mineBlock': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/nodeInfo': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/addPeer': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
