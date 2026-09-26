import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomBytes } from 'node:crypto'

const nonce = randomBytes(18).toString('base64')

const proxy = {
  '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
  '/ws': { target: 'ws://127.0.0.1:8000', ws: true, changeOrigin: false },
}
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:5173 ws://127.0.0.1:5173 ws://localhost:4173 ws://127.0.0.1:4173; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
}
export default defineConfig({
  plugins: [react()],
  html: { cspNonce: nonce },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy, headers },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy, headers },
})
