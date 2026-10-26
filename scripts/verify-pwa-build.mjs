import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const requiredFiles = ['index.html', 'manifest.webmanifest', 'sw.js', 'railway-icon-180.png', 'railway-icon-192.png', 'railway-icon-512.png']

for (const file of requiredFiles) {
  if (!existsSync(resolve(dist, file))) throw new Error(`公開用ファイルが不足しています: ${file}`)
}

const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'))
const serviceWorker = readFileSync(resolve(dist, 'sw.js'), 'utf8')

if (!html.includes('rel="apple-touch-icon"')) throw new Error('iPhoneホーム画面用アイコンが設定されていません')
if (manifest.display !== 'standalone' || !manifest.start_url || !manifest.scope) throw new Error('ホーム画面版の起動設定が不完全です')
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) throw new Error('PWAアイコンが不足しています')

for (const icon of manifest.icons) {
  const iconFile = basename(new URL(icon.src, 'https://example.invalid').pathname)
  if (!existsSync(resolve(dist, iconFile))) throw new Error(`アイコン本体がありません: ${iconFile}`)
  if (!serviceWorker.includes(iconFile)) throw new Error(`アイコンがオフライン保存対象に含まれていません: ${iconFile}`)
}

for (const file of ['index.html', 'manifest.webmanifest', 'railway-icon-180.png']) {
  if (!serviceWorker.includes(file)) throw new Error(`オフライン保存対象に含まれていません: ${file}`)
}

console.log('PWA公開データ: ホーム画面設定とオフライン保存対象を確認しました。')
