import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, HardDrive, HelpCircle, ShieldCheck, WifiOff } from 'lucide-react'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel } from '../storage/db'

interface SettingsTabProps {
  onOpenOnboarding: () => void
}

export function SettingsTab({ onOpenOnboarding }: SettingsTabProps) {
  const learned = useLiveQuery(() => db.manualMastery.where('learned').equals(1).count(), []) ?? 0
  const answers = useLiveQuery(() => db.quizAnswers.count(), []) ?? 0
  const routes = useLiveQuery(() => db.routeHistory.count(), []) ?? 0

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
        <p>一度読み込んだ後は、アプリ本体を通信なしでも開ける構成です。iPhoneでの最終確認は今後行います。</p>
      </article>
      <article className="settings-card disabled-card" aria-disabled="true">
        <h2><Download size={20} aria-hidden="true" />バックアップ</h2>
        <p>安全な復元手順を設計してから追加します。現段階では誤って上書きしないよう無効です。</p>
      </article>
      <p className="storage-note"><HardDrive size={16} aria-hidden="true" /><Database size={16} aria-hidden="true" />学習記録はこの端末のブラウザ内に保存されます。</p>
    </section>
  )
}
