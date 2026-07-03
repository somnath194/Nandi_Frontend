import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Vite 5 blocks requests whose Host header isn't allowlisted. When you
    // tunnel 5173 out to a domain (e.g. app2.shuun.site via cloudflared),
    // add it here or Vite returns "host not allowed". A leading dot allows
    // the domain and all its subdomains.
    allowedHosts: ['.shuun.site', 'localhost'],
  },
})
