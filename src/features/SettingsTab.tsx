import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, HardDrive, HelpCircle, ShieldCheck, WifiOff } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel } from '../storage/db'
import { createBackup, createBackupFile, presentBackupFile } from '../storage/backup'
import { usePwaStatus } from '../pwaStatus'

interface SettingsTabProps {
  onOpenOnboarding: () => void
}

export function SettingsTab({ onOpenOnboarding }: SettingsTabProps) {
  const pwaStatus = usePwaStatus()
  const learned = useLiveQuery(() => db.manualMastery.where('learned').equals(1).count(), []) ?? 0
  const answers = useLiveQuery(() => db.quizAnswers.count(), []) ?? 0
  const routes = useLiveQuery(() => db.routeHistory.count(), []) ?? 0
  const [backupWorking, setBackupWorking] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')

  const exportBackup = async () => {
    setBackupWorking(true)
    setBackupMessage('')
    try {
      const file = createBackupFile(await createBackup())
      const method = await presentBackupFile(file)
      setBackupMessage(method === 'share'
        ? '共有メニューを閉じました。選んだ保存先にファイルがあるかご確認ください。'
        : 'ファイルの書き出しを開始しました。ダウンロード先をご確認ください。')
    } catch (error) {
      setBackupMessage(error instanceof DOMException && error.name === 'AbortError'
        ? '書き出しを中止しました。端末内のデータは変更していません。'
        : '書き出しを開始できませんでした。時間をおいてもう一度お試しください。')
    } finally {
      setBackupWorking(false)
    }
  }

  return (
    <section className="screen" aria-labelledby="settings-title">
      <header className="screen-heading"><div><span className="eyebrow">データとアプリ</span><h1 id="settings-title">設定</h1></div></header>
      <div className="settings-summary">
        <div><strong>{learned}</strong><span>覚えた駅</span></div>
        <div><strong>{answers}</strong><span>クイズ回答</span></div>
        <div><strong>{routes}</strong><span>経路記録</span></div>
      </div>
      <article className="settings-card">
        <h2><ShieldCheck size={20} aria-hidden="true" />現在のデータ</h2>
        <dl>
          <div><dt>種類</dt><dd>架空の試験データ</dd></div>
          <div><dt>データ版</dt><dd>{demoNetwork.version}</dd></div>
          <div><dt>保存領域</dt><dd>{storageChannel}</dd></div>
        </dl>
      </article>
      <button className="settings-action" onClick={onOpenOnboarding}>
        <HelpCircle size={20} aria-hidden="true" /><span><strong>最初の案内をもう一度見る</strong><small>使い方と学習地域を確認します</small></span>
      </button>
      <article className="settings-card">
        <h2><WifiOff size={20} aria-hidden="true" />オフライン利用</h2>
        <dl className="offline-status-list">
          <div><dt>現在の通信</dt><dd className={pwaStatus.online ? 'ready' : 'offline'}>{pwaStatus.online ? '通信あり' : '通信なし'}</dd></div>
          <div><dt>オフライン準備</dt><dd className={pwaStatus.offlineReady ? 'ready' : 'waiting'}>{pwaStatus.offlineReady ? '準備完了' : pwaStatus.registrationError ? '確認できません' : '準備中'}</dd></div>
        </dl>
        <p>{pwaStatus.offlineReady ? '通信を切っても、保存済みの地図・クイズ・経路機能を利用できます。' : '通信がある状態でこのアプリを一度開いたままにしてください。'}</p>
      </article>
      <article className="settings-card backup-card">
        <h2><Download size={20} aria-hidden="true" />バックアップ</h2>
        <p>学習記録・クイズ・経路・お気に入りを1つのJSONファイルにまとめます。書き出すだけなので、端末内の記録は変更しません。</p>
        <button className="backup-export-button" disabled={backupWorking} onClick={() => void exportBackup()}><Download size={17} aria-hidden="true" />{backupWorking ? '準備しています…' : 'バックアップを書き出す'}</button>
        <p className="backup-message" aria-live="polite">{backupMessage}</p>
        <small>復元機能は、安全な確認手順と統合規則を決めてから追加します。</small>
      </article>
      <p className="storage-note"><HardDrive size={16} aria-hidden="true" /><Database size={16} aria-hidden="true" />学習記録はこの端末のブラウザ内に保存されます。</p>
    </section>
  )
}
