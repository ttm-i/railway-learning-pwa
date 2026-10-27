import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, Database, Download, FileSearch, HardDrive, HelpCircle, ShieldCheck, WifiOff } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel } from '../storage/db'
import { BackupValidationError, createBackup, createBackupFile, maximumBackupFileBytes, parseBackupPreview, presentBackupFile, type BackupPreview } from '../storage/backup'
import { usePwaStatus } from '../pwaStatus'
import { checkStorageHealth, formatStorageBytes, type StorageHealthResult } from '../storage/storageHealth'

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
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
  const [previewMessage, setPreviewMessage] = useState('')
  const [storageChecking, setStorageChecking] = useState(false)
  const [storageHealth, setStorageHealth] = useState<StorageHealthResult | null>(null)

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

  const inspectBackup = async (file: File) => {
    setBackupPreview(null)
    setPreviewMessage('')
    if (file.size > maximumBackupFileBytes) {
      setPreviewMessage('ファイルが大きすぎます。20MB以下のバックアップを選んでください。')
      return
    }
    try {
      setBackupPreview(parseBackupPreview(await file.text()))
    } catch (error) {
      setPreviewMessage(error instanceof BackupValidationError ? error.message : 'ファイルを読み取れませんでした。')
    }
  }

  const formatBackupDate = (value: string) => new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))

  const inspectStorage = async () => {
    setStorageChecking(true)
    setStorageHealth(await checkStorageHealth())
    setStorageChecking(false)
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
      <article className="settings-card storage-health-card">
        <h2><HardDrive size={20} aria-hidden="true" />保存の安全確認</h2>
        <p>一時的な確認データを書いてすぐ削除し、現在もこの端末へ保存できるか確かめます。学習記録は変更しません。</p>
        <button className="storage-check-button" disabled={storageChecking} onClick={() => void inspectStorage()}>{storageChecking ? '確認しています…' : '保存状態を確認する'}</button>
        {storageHealth && <div className={`storage-health-result ${!storageHealth.writable || storageHealth.lowSpace ? 'warning' : 'success'}`} role="status">
          {storageHealth.writable && !storageHealth.lowSpace ? <CheckCircle2 size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}
          <div>
            <strong>{!storageHealth.writable ? '保存できませんでした' : storageHealth.lowSpace ? '空き容量が少ない可能性があります' : '端末内への保存を確認しました'}</strong>
            {storageHealth.remainingBytes !== undefined ? <span>ブラウザ用の空き目安：{formatStorageBytes(storageHealth.remainingBytes)}</span> : <span>容量の数値はiPhone側で管理されています。</span>}
            {!storageHealth.writable && <span>先にバックアップを書き出し、iPhoneの空き容量をご確認ください。</span>}
          </div>
        </div>}
        <ul className="storage-safety-tips">
          <li>大切な記録は定期的にバックアップを書き出す</li>
          <li>iPhoneの空き容量を十分に保つ</li>
          <li>このアプリやSafariのWebサイトデータを削除すると、記録が失われる可能性があります</li>
        </ul>
      </article>
      <article className="settings-card backup-card">
        <h2><Download size={20} aria-hidden="true" />バックアップ</h2>
        <p>学習記録・クイズ・経路・お気に入りを1つのJSONファイルにまとめます。書き出すだけなので、端末内の記録は変更しません。</p>
        <button className="backup-export-button" disabled={backupWorking} onClick={() => void exportBackup()}><Download size={17} aria-hidden="true" />{backupWorking ? '準備しています…' : 'バックアップを書き出す'}</button>
        <p className="backup-message" aria-live="polite">{backupMessage}</p>
        <div className="backup-divider"><span>保存済みファイルの確認</span></div>
        <label className="backup-inspect-button"><FileSearch size={17} aria-hidden="true" />バックアップファイルを確認する<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectBackup(file); event.target.value = '' }} /></label>
        {previewMessage && <p className="backup-preview-error" role="alert">{previewMessage}</p>}
        {backupPreview && <div className="backup-preview" aria-label="バックアップ内容の確認結果">
          <strong>ファイル内容（確認のみ）</strong>
          <dl>
            <div><dt>書き出し日時</dt><dd>{formatBackupDate(backupPreview.exportedAt)}</dd></div>
            <div><dt>覚えた駅</dt><dd>{backupPreview.counts.learnedStations}件</dd></div>
            <div><dt>クイズ回答</dt><dd>{backupPreview.counts.quizAnswers}件</dd></div>
            <div><dt>経路記録</dt><dd>{backupPreview.counts.routeHistory}件</dd></div>
            <div><dt>お気に入り</dt><dd>{backupPreview.counts.favorites}件</dd></div>
            <div><dt>途中状態</dt><dd>{backupPreview.counts.suspendedActivities}件</dd></div>
            <div><dt>アプリ版</dt><dd>{backupPreview.appVersion}</dd></div>
          </dl>
          <p>内容を表示しただけで、端末内のデータは変更していません。</p>
        </div>}
        <small>復元機能は、安全な確認手順と統合規則を決めてから追加します。</small>
      </article>
      <p className="storage-note"><HardDrive size={16} aria-hidden="true" /><Database size={16} aria-hidden="true" />学習記録はこの端末のブラウザ内に保存されます。</p>
    </section>
  )
}
