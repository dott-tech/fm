import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the app icons (Android, iOS, favicon) from public/logo.svg.
// Run: npm run icons
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
