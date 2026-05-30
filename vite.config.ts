import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy: avoids any CORS edge cases while developing.
// In production both APIs are public + CORS-enabled, so the app calls them directly.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gt': {
        target: 'https://api.geckoterminal.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gt/, ''),
      },
      '/ds': {
        target: 'https://api.dexscreener.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ds/, ''),
      },
      // Blockscout (server-side in dev too, mirroring the prod /api/blockscout function)
      '/bs/pulsechain': {
        target: 'https://api.scan.pulsechain.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bs\/pulsechain/, '/api/v2'),
      },
      '/bs/ethereum': {
        target: 'https://eth.blockscout.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bs\/ethereum/, '/api/v2'),
      },
    },
  },
})
