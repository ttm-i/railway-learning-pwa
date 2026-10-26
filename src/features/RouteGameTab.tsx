import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CheckCircle2, Flag, RotateCcw, Undo2 } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { calculateMetrics, getNeighbors, getStation, isValidPath } from '../domain/graph'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

const initialStart: StableId = 'demo:station:harukaze'
const initialDestination: StableId = 'demo:station:hoshimi'

export function RouteGameTab() {
  const saved = useLiveQuery(() => db.routeSuspension.get('active'), [])
  const [startId, setStartId] = useState<StableId>(initialStart)
  const [destinationId, setDestinationId] = useState<StableId>(initialDestination)
  const [path, setPath] = useState<StableId[]>([initialStart])
  const [message, setMessage] = useState('現在駅を確認して、次の駅を選びましょう。')
  const [restored, setRestored] = useState(false)
  const historyCount = useLiveQuery(() => db.routeHistory.count(), []) ?? 0

  useEffect(() => {
    if (saved && !restored && saved.datasetVersion === demoNetwork.version && isValidPath(demoNetwork, saved.path)) {
      setStartId(saved.startId)
      setDestinationId(saved.destinationId)
      setPath(saved.path)
      setMessage('前回の続きから再開しました。')
      setRestored(true)
    } else if (saved === undefined && !restored) {
      setRestored(true)
    }
  }, [saved, restored])

  useEffect(() => {
    if (!restored) return
    void db.routeSuspension.put({
      id: 'active', startId, destinationId, path, datasetVersion: demoNetwork.version, updatedAt: new Date().toISOString()
    })
  }, [startId, destinationId, path, restored])

  const currentId = path[path.length - 1]
  const candidates = getNeighbors(demoNetwork, currentId)
  const arrived = currentId === destinationId
  const metrics = useMemo(() => calculateMetrics(demoNetwork, path), [path])

  const move = (stationId: StableId) => {
    if (!candidates.some((candidate) => candidate.stationId === stationId)) {
      setMessage('その駅へは直接進めません。経路は変更していません。')
      return
    }
    setPath((value) => [...value, stationId])
    setMessage(stationId === destinationId ? '目的地に到着しました。内容を確認して確定してください。' : '次の駅へ進みました。')
  }

  const restart = (nextStart = startId, nextDestination = destinationId) => {
    setPath([nextStart])
    setMessage('新しい経路を開始しました。')
  }

  const confirm = async () => {
    if (!arrived) return
    await db.routeHistory.add({
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), datasetVersion: demoNetwork.version, path, metrics
    })
    await db.routeSuspension.delete('active')
    restart()
    setMessage('経路を記録しました。もう一度挑戦できます。')
  }

  return (
    <section className="screen" aria-labelledby="route-title">
      <header className="screen-heading">
        <div><span className="eyebrow">自分で組み立てる</span><h1 id="route-title">基本経路ゲーム</h1></div>
        <span className="data-pill">記録 {historyCount}件</span>
      </header>
      <div className="route-selectors">
        <label>出発駅
          <select value={startId} onChange={(event) => { const id = event.target.value as StableId; setStartId(id); restart(id, destinationId) }}>
            {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
          </select>
        </label>
        <ArrowRight size={18} aria-hidden="true" />
        <label>目的駅
          <select value={destinationId} onChange={(event) => { const id = event.target.value as StableId; setDestinationId(id); restart(startId, id) }}>
            {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
          </select>
        </label>
      </div>
      <RailMap
        selectedStationId={currentId}
        destinationId={destinationId}
        route={path}
        candidateIds={candidates.map((candidate) => candidate.stationId)}
        onSelectStation={move}
      />
      <div className="game-status" aria-live="polite"><Flag size={17} aria-hidden="true" /><span>{message}</span></div>
      <article className="route-panel">
        <div className="route-panel__heading">
          <div><span className="eyebrow">現在駅</span><h2>{getStation(demoNetwork, currentId)?.canonicalName}</h2></div>
          <button className="icon-button" disabled={path.length <= 1} onClick={() => { setPath((value) => value.slice(0, -1)); setMessage('直前の1操作を戻しました。') }}>
            <Undo2 size={18} aria-hidden="true" />1操作戻す
          </button>
        </div>
        <div className="metric-row">
          <span><strong>{metrics.railSegments}</strong> 駅間</span>
          <span><strong>{metrics.transfers}</strong> 乗換</span>
          <span><strong>{metrics.revisits}</strong> 再訪</span>
        </div>
        <h3>次に進める駅</h3>
        <div className="candidate-list">
          {candidates.map(({ stationId, edge }) => {
            const line = demoNetwork.lines.find((item) => item.stableId === edge.lineId)!
            return <button key={stationId} onClick={() => move(stationId)}><i style={{ background: line.color }} /><span>{getStation(demoNetwork, stationId)?.canonicalName}</span><small>{line.name}</small></button>
          })}
        </div>
        {arrived && <button className="primary-button confirm-button" onClick={confirm}><CheckCircle2 size={19} aria-hidden="true" />この経路で確定</button>}
        <button className="text-button" onClick={() => restart()}><RotateCcw size={16} aria-hidden="true" />最初からやり直す</button>
      </article>
    </section>
  )
}
