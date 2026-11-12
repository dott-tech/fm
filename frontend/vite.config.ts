import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev, forward /api calls to the backend so the frontend never
    // needs to know the backend URL or deal with CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
