import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The browser talks to /api on the Vite origin; Vite forwards to FastAPI
// with the /api prefix removed. Same-origin => no CORS needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
