import { useState } from 'react'
import { BookOpenCheck, Map, Route, Settings } from 'lucide-react'
import { DemoNotice } from './components/DemoNotice'
import { MapTab } from './features/MapTab'
import { QuizTab } from './features/QuizTab'
import { RouteGameTab } from './features/RouteGameTab'
import { SettingsTab } from './features/SettingsTab'

type TabId = 'map' | 'route' | 'learn' | 'settings'

const tabs = [
  { id: 'map' as const, label: '地図', icon: Map },
  { id: 'route' as const, label: '経路', icon: Route },
  { id: 'learn' as const, label: '学習', icon: BookOpenCheck },
  { id: 'settings' as const, label: '設定', icon: Settings }
]

export default function App() {
  const [tab, setTab] = useState<TabId>('map')
  return (
    <div className="app-shell">
      <DemoNotice />
      <main>
        {tab === 'map' && <MapTab />}
        {tab === 'route' && <RouteGameTab />}
        {tab === 'learn' && <QuizTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <nav className="bottom-nav" aria-label="メインメニュー">
        {tabs.map((item) => {
          const Icon = item.icon
          return <button key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><Icon size={21} aria-hidden="true" /><span>{item.label}</span></button>
        })}
      </nav>
    </div>
  )
}
