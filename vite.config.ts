import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH задаётся в GitHub Actions ("/storage/") для GitHub Pages.
const base = process.env.BASE_PATH ?? '/'
// Сборка без сервис-воркера — для просмотра по ссылке в Claude (там он недоступен).
const pwa = process.env.NO_PWA !== '1'

export default defineConfig({
  base,
  plugins: [
    react(),
    pwa &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Маленький музей',
        short_name: 'Музей',
        description: 'Рисунки и поделки Кирилла и Марка',
        lang: 'ru',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Вариант нейросети для видеокарты не используется (считаем на процессоре).
        globIgnores: ['**/ort.webgpu*'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Нейросеть для вырезания фона (~60 МБ) скачивается при первом вырезании и дальше
        // берётся из кэша. Куски названы по хешу содержимого, поэтому не устаревают.
        runtimeCaching: [
          {
            urlPattern: /\/bg-removal\/[0-9a-f]{64}$/,
            handler: 'CacheFirst',
            options: { cacheName: 'bg-removal', expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: /\/bg-removal\/resources\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'bg-removal-index' },
          },
        ],
      },
    }),
  ],
  // Поток с нейросетью (src/lib/image/ai.worker.ts) подгружает части библиотеки по ходу дела.
  worker: { format: 'es' },
  build: {
    // model-viewer (3D) весит ~1 МБ, но грузится только на странице поделки.
    chunkSizeWarningLimit: 1100,
  },
})
