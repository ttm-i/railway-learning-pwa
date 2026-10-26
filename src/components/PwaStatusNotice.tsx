import { Download, WifiOff } from 'lucide-react'
import { pwaStatusStore, usePwaStatus } from '../pwaStatus'

export function PwaStatusNotice() {
  const status = usePwaStatus()

  if (status.updateAvailable) {
    return (
      <aside className="pwa-status-notice update" role="status">
        <Download size={18} aria-hidden="true" />
        <span><strong>新しい版を利用できます</strong><small>学習記録はそのまま引き継がれます。</small></span>
        <button onClick={() => void pwaStatusStore.applyUpdate()}>更新する</button>
      </aside>
    )
  }

  if (!status.online) {
    return (
      <aside className="pwa-status-notice offline" role="status">
        <WifiOff size={18} aria-hidden="true" />
        <span><strong>オフラインで利用中</strong><small>{status.offlineReady ? '保存済みの機能とデータを利用しています。' : '一部の画面を開けない可能性があります。'}</small></span>
      </aside>
    )
  }

  return null
}
