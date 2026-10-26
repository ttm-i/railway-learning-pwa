import { useState } from 'react'
import { BookOpenCheck, Map, Route, Settings } from 'lucide-react'
import { DemoNotice } from './components/DemoNotice'
import { Onboarding } from './components/Onboarding'
import { MapTab } from './features/MapTab'
import { QuizTab } from './features/QuizTab'
import { RouteGameTab } from './features/RouteGameTab'
import { SettingsTab } from './features/SettingsTab'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './storage/db'

type TabId = 'map' | 'route' | 'learn' | 'settings'

const tabs = [
  { id: 'map' as const, label: '地図', icon: Map },
  { id: 'route' as const, label: '経路', icon: Route },
  { id: 'learn' as const, label: '学習', icon: BookOpenCheck },
  { id: 'settings' as const, label: '設定', icon: Settings }
]

export default function App() {
  const [tab, setTab] = useState<TabId>('map')
  const [manualOnboarding, setManualOnboarding] = useState(false)
  const onboardingRecord = useLiveQuery(() => db.settings.get('onboardingComplete'), [], null)
  const showOnboarding = manualOnboarding || (onboardingRecord !== null && onboardingRecord?.value !== true)
  return (
    <div className="app-shell">
      <DemoNotice />
      <main>
        {tab === 'map' && <MapTab />}
        {tab === 'route' && <RouteGameTab />}
        {tab === 'learn' && <QuizTab />}
        {tab === 'settings' && <SettingsTab onOpenOnboarding={() => setManualOnboarding(true)} />}
      </main>
      <nav className="bottom-nav" aria-label="メインメニュー">
        {tabs.map((item) => {
          const Icon = item.icon
          return <button key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><Icon size={21} aria-hidden="true" /><span>{item.label}</span></button>
        })}
      </nav>
      {showOnboarding && <Onboarding onClose={() => setManualOnboarding(false)} />}
    </div>
  )
}
