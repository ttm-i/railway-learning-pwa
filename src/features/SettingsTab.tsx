import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, Database, Download, FileSearch, HardDrive, HelpCircle, RotateCcw, ShieldCheck, WifiOff } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel } from '../storage/db'
import { BackupValidationError, countRecordsSinceBackup, createBackup, createBackupFile, createBackupMetadata, createBackupPreview, getBackupMergeBlockReason, getBackupMetadata, getBackupRestoreBlockReason, getRecoverySnapshot, maximumBackupFileBytes, mergeWithBackup, parseBackup, presentBackupFile, recoverySnapshotSettingKey, replaceWithBackup, restoreRecoverySnapshot, shouldShowBackupReminder, type BackupPreview, type RailwayLearningBackup } from '../storage/backup'
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
  const backupMetadataRecord = useLiveQuery(() => db.settings.get('backupMetadata'), [], null)
  const recoverySnapshotRecord = useLiveQuery(() => db.settings.get(recoverySnapshotSettingKey), [], null)
  const [backupWorking, setBackupWorking] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
  const [previewMessage, setPreviewMessage] = useState('')
  const [restoreCandidate, setRestoreCandidate] = useState<{ backup: RailwayLearningBackup, fileName: string } | null>(null)
  const [restoreBlockReason, setRestoreBlockReason] = useState('')
  const [mergeBlockReason, setMergeBlockReason] = useState('')
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge' | null>(null)
  const [restoreWorking, setRestoreWorking] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [undoConfirm, setUndoConfirm] = useState(false)
  const [storageChecking, setStorageChecking] = useState(false)
  const [storageHealth, setStorageHealth] = useState<StorageHealthResult | null>(null)
  const backupMetadata = getBackupMetadata(backupMetadataRecord?.value)
  const recoverySnapshot = getRecoverySnapshot(recoverySnapshotRecord?.value)
  const recordsSinceBackup = backupMetadata
    ? countRecordsSinceBackup(backupMetadata, { learnedStations: learned, quizAnswers: answers, routeHistory: routes })
    : 0
  const showBackupReminder = shouldShowBackupReminder(backupMetadata, recordsSinceBackup)

  const exportBackup = async () => {
    setBackupWorking(true)
    setBackupMessage('')
    try {
      const backup = await createBackup()
      const file = createBackupFile(backup)
      const method = await presentBackupFile(file)
      try {
        await db.settings.put({ key: 'backupMetadata', value: createBackupMetadata(backup, file.name) })
      } catch {
        // ファイル書き出し自体は開始済みなので、補助情報の保存失敗で成功案内を上書きしない。
      }
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
    setRestoreCandidate(null)
    setRestoreBlockReason('')
    setMergeBlockReason('')
    setRestoreMode(null)
    setRestoreMessage('')
    if (file.size > maximumBackupFileBytes) {
      setPreviewMessage('ファイルが大きすぎます。20MB以下のバックアップを選んでください。')
      return
    }
    try {
      const backup = parseBackup(await file.text())
      setBackupPreview(createBackupPreview(backup))
      setRestoreCandidate({ backup, fileName: file.name })
      setRestoreBlockReason(getBackupRestoreBlockReason(backup) ?? '')
      setMergeBlockReason(getBackupMergeBlockReason(backup) ?? '')
    } catch (error) {
      setPreviewMessage(error instanceof BackupValidationError ? error.message : 'ファイルを読み取れませんでした。')
    }
  }

  const restoreBackup = async () => {
    if (!restoreCandidate || restoreBlockReason) return
    setRestoreWorking(true)
    setRestoreMessage('')
    try {
      await replaceWithBackup(restoreCandidate.backup, restoreCandidate.fileName)
      setRestoreMessage('バックアップの内容へ置き換えました。復元前の状態は、この端末内に退避しています。')
      setRestoreMode(null)
      setRestoreCandidate(null)
      setBackupPreview(null)
    } catch (error) {
      setRestoreMessage(error instanceof BackupValidationError
        ? error.message
        : '復元できませんでした。現在の記録は変更していません。')
    } finally {
      setRestoreWorking(false)
    }
  }

  const mergeBackup = async () => {
    if (!restoreCandidate || restoreBlockReason || mergeBlockReason) return
    setRestoreWorking(true)
    setRestoreMessage('')
    try {
      const result = await mergeWithBackup(restoreCandidate.backup, restoreCandidate.fileName)
      setRestoreMessage(`統合しました。追加${result.addedRecords}件・習得状態の更新${result.updatedMastery}件・削除済みの復活防止${result.preventedDeletedRecords}件・現在側を残した競合${result.ignoredConflicts}件です。`)
      setRestoreMode(null)
      setRestoreCandidate(null)
      setBackupPreview(null)
    } catch (error) {
      setRestoreMessage(error instanceof BackupValidationError
        ? error.message
        : '統合できませんでした。現在の記録は変更していません。')
    } finally {
      setRestoreWorking(false)
    }
  }

  const undoRestore = async () => {
    if (!recoverySnapshot) return
    setRestoreWorking(true)
    setRestoreMessage('')
    try {
      await restoreRecoverySnapshot(recoverySnapshot)
      setRestoreMessage('復元前の状態へ戻しました。')
      setUndoConfirm(false)
    } catch {
      setRestoreMessage('元の状態へ戻せませんでした。現在の記録は変更していません。')
    } finally {
      setRestoreWorking(false)
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
        <div className="backup-activity">
          {backupMetadata ? <>
            <span><strong>前回の書き出し操作</strong>{formatBackupDate(backupMetadata.lastExportAttemptAt)}</span>
            <span><strong>その後に増えた記録</strong>{recordsSinceBackup}件</span>
          </> : <span><strong>前回の書き出し操作</strong>まだ記録されていません</span>}
          <small>ファイル保存の完了はアプリから確認できないため、共有メニューを閉じた時刻を表示します。</small>
        </div>
        {showBackupReminder && <div className="backup-reminder" role="status">
          <AlertTriangle size={19} aria-hidden="true" />
          <div><strong>そろそろバックアップしておくと安心です</strong><span>前回の操作から30日以上たち、新しい記録が10件以上増えています。</span></div>
        </div>}
        <button className="backup-export-button" disabled={backupWorking} onClick={() => void exportBackup()}><Download size={17} aria-hidden="true" />{backupWorking ? '準備しています…' : 'バックアップを書き出す'}</button>
        <p className="backup-message" aria-live="polite">{backupMessage}</p>
        <div className="backup-divider"><span>保存済みファイルの確認</span></div>
        {recoverySnapshot && <div className="restore-recovery">
          <RotateCcw size={19} aria-hidden="true" />
          <div><strong>復元前の状態を退避中</strong><span>{formatBackupDate(recoverySnapshot.createdAt)}の復元前データです。</span></div>
          {!undoConfirm
            ? <button disabled={restoreWorking} onClick={() => setUndoConfirm(true)}>復元前の状態に戻す</button>
            : <div className="restore-confirm-actions"><span>現在の復元結果を取り消しますか？</span><button className="secondary" onClick={() => setUndoConfirm(false)}>やめる</button><button disabled={restoreWorking} onClick={() => void undoRestore()}>{restoreWorking ? '戻しています…' : '元の状態へ戻す'}</button></div>}
        </div>}
        <label className="backup-inspect-button"><FileSearch size={17} aria-hidden="true" />バックアップファイルを確認する<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectBackup(file); event.target.value = '' }} /></label>
        {previewMessage && <p className="backup-preview-error" role="alert">{previewMessage}</p>}
        {backupPreview && <div className="backup-preview" aria-label="バックアップ内容の確認結果">
          <strong>復元するファイルの内容</strong>
          <dl>
            <div><dt>書き出し日時</dt><dd>{formatBackupDate(backupPreview.exportedAt)}</dd></div>
            <div><dt>覚えた駅</dt><dd>{backupPreview.counts.learnedStations}件</dd></div>
            <div><dt>クイズ回答</dt><dd>{backupPreview.counts.quizAnswers}件</dd></div>
            <div><dt>経路記録</dt><dd>{backupPreview.counts.routeHistory}件</dd></div>
            <div><dt>お気に入り</dt><dd>{backupPreview.counts.favorites}件</dd></div>
            <div><dt>途中状態</dt><dd>{backupPreview.counts.suspendedActivities}件</dd></div>
            <div><dt>アプリ版</dt><dd>{backupPreview.appVersion}</dd></div>
            <div><dt>ファイル形式</dt><dd>{backupPreview.schemaVersion >= 2 ? '新形式（統合対応）' : '従来形式（置き換えのみ）'}</dd></div>
          </dl>
          <p>この時点では、端末内のデータは変更していません。</p>
          {restoreBlockReason
            ? <p className="restore-blocked" role="alert">{restoreBlockReason}</p>
            : restoreMode === null
              ? <>
                <div className="restore-mode-buttons"><button onClick={() => setRestoreMode('replace')}>置き換えの確認へ</button><button disabled={Boolean(mergeBlockReason)} onClick={() => setRestoreMode('merge')}>統合の確認へ</button></div>
                {mergeBlockReason && <p className="merge-unavailable">{mergeBlockReason}</p>}
              </>
              : restoreMode === 'replace' ? <div className="restore-confirm">
                <strong>現在の記録を、このファイルの内容へ置き換えます</strong>
                <span>実行前の状態は自動で退避します。記録を混ぜ合わせる操作ではありません。</span>
                <div><button className="secondary" onClick={() => setRestoreMode(null)}>やめる</button><button disabled={restoreWorking} onClick={() => void restoreBackup()}>{restoreWorking ? '復元しています…' : '退避して置き換える'}</button></div>
              </div> : <div className="restore-confirm merge-confirm">
                <strong>現在の記録を残し、安全なルールで統合します</strong>
                <span>端末の設定と進行中の学習は維持し、履歴の重複や削除済み記録の復活を防ぎます。実行前の状態は自動で退避します。</span>
                <div><button className="secondary" onClick={() => setRestoreMode(null)}>やめる</button><button disabled={restoreWorking} onClick={() => void mergeBackup()}>{restoreWorking ? '統合しています…' : '退避して統合する'}</button></div>
              </div>}
        </div>}
        <p className="restore-message" role="status" aria-live="polite">{restoreMessage}</p>
        <small>「統合」は新形式のバックアップで利用できます。従来形式は、安全のため「置き換え」のみ対応します。</small>
      </article>
      <p className="storage-note"><HardDrive size={16} aria-hidden="true" /><Database size={16} aria-hidden="true" />学習記録はこの端末のブラウザ内に保存されます。</p>
    </section>
  )
}
