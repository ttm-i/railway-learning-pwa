import { useState } from 'react'
import { BookOpenCheck, Map, Route, Sparkles } from 'lucide-react'
import { db } from '../storage/db'

interface OnboardingProps {
  onClose: () => void
}

const regionOptions = [
  { id: 'tokyo-23', label: '東京23区', available: true },
  { id: 'kawasaki', label: '川崎市', available: false },
  { id: 'yokohama', label: '横浜市', available: false }
]

export function Onboarding({ onClose }: OnboardingProps) {
  const [regions, setRegions] = useState<string[]>(['tokyo-23'])

  const finish = async () => {
    await db.transaction('rw', db.settings, async () => {
      await db.settings.put({ key: 'studyRegions', value: regions })
      await db.settings.put({ key: 'onboardingComplete', value: true })
    })
    onClose()
  }

  const toggleRegion = (id: string) => {
    setRegions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-mark"><Sparkles size={25} aria-hidden="true" /></div>
        <span className="eyebrow">はじめに</span>
        <h1 id="onboarding-title">路線を、見て・考えて・覚える</h1>
        <p>このアプリでは、路線図を眺めるだけでなく、クイズや経路ゲームで駅のつながりを学べます。</p>

        <div className="onboarding-features">
          <div><Map aria-hidden="true" /><span><strong>地図</strong>駅を選んで隣接駅を確認</span></div>
          <div><Route aria-hidden="true" /><span><strong>経路</strong>自分で目的地まで組み立て</span></div>
          <div><BookOpenCheck aria-hidden="true" /><span><strong>学習</strong>クイズで駅順を確認</span></div>
        </div>

        <fieldset>
          <legend>今後学びたい地域</legend>
          <p>現在は架空データで試験中です。選択は今後の実在データ追加時に使います。</p>
          {regionOptions.map((region) => (
            <label key={region.id}>
              <input type="checkbox" checked={regions.includes(region.id)} onChange={() => toggleRegion(region.id)} />
              <span>{region.label}</span>
              {!region.available && <small>準備中</small>}
            </label>
          ))}
        </fieldset>

        <button className="primary-button onboarding-start" disabled={regions.length === 0} onClick={finish}>この内容で始める</button>
        <button className="text-button" onClick={finish}>案内をスキップ</button>
      </section>
    </div>
  )
}
