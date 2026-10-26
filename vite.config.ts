import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const base = env.VITE_BASE_PATH || '/'
  const channel = env.VITE_APP_CHANNEL || 'development'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['railway-icon.svg', 'railway-icon-180.png', 'railway-icon-192.png', 'railway-icon-512.png'],
        manifest: {
          name: channel === 'stable' ? '首都圏鉄道学習' : `首都圏鉄道学習 (${channel})`,
          short_name: '鉄道学習',
          description: '路線図・クイズ・経路ゲームで鉄道を学ぶオフライン対応アプリ',
          theme_color: '#f4f7f3',
          background_color: '#f4f7f3',
          display: 'standalone',
          start_url: base,
          scope: base,
          lang: 'ja',
          icons: [
            {
              src: `${base}railway-icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${base}railway-icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          cacheId: `railway-learning-${channel}`,
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true
        }
      })
    ]
  }
})
