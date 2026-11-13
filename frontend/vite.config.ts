import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Makes the app installable on Android ("Add to home screen") and loads
    // the app shell instantly from cache. Icons come from `npm run icons`.
    VitePWA({
      registerType: 'autoUpdate', // new versions activate on the next open
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Driver Finance',
        short_name: 'Driver Finance',
        description: 'Track what you really earn after fuel, repairs and platform cuts.',
        theme_color: '#047857',
        background_color: '#fafaf9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app's own files are cached. API responses (money, sessions)
        // are never cached, and /api URLs never get the app shell instead.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // In dev, forward /api calls to the backend so the frontend never
    // needs to know the backend URL or deal with CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
