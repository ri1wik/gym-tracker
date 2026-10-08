import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// The base path is permanent. The manifest id, start_url, scope and the
// service worker fallback all hang off it; changing it after a friend
// installs the app turns their installed copy into a different app.
export const BASE = '/gym-tracker/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg', '.nojekyll'],
      manifest: {
        id: BASE,
        name: 'Recomp',
        short_name: 'Recomp',
        description: 'Gym tracker for body recomposition',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0D10',
        theme_color: '#0B0D10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache every emitted chunk (GitHub Pages deletes old hashed
        // chunks on each deploy, so a lazy chunk must already be cached).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        navigateFallback: BASE + 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // No runtime caching routes are declared on purpose: nothing from
        // the backend (auth, data, signed photo URLs) may ever enter a cache.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
