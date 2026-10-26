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
        includeAssets: ['railway-icon.svg'],
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
              src: `${base}railway-icon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
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
