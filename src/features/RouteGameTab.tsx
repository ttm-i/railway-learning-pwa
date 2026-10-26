import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CheckCircle2, ChevronDown, Flag, Gamepad2, History, Lightbulb, List, RotateCcw, Scissors, Undo2 } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { calculateMetrics, getNeighbors, getStation, isValidPath } from '../domain/graph'
import { getHintText, type HintLevel, type RouteLabelMode } from '../domain/routeGame'
import { getRouteLineIds } from '../domain/routeHistory'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'
import { RouteHistoryView } from './RouteHistoryView'

const initialStart: StableId = 'demo:station:harukaze'
const initialDestination: StableId = 'demo:station:hoshimi'
const labelModes: { value: RouteLabelMode; label: string }[] = [
  { value: 'all', label: 'すべて表示' },
  { value: 'stations-hidden', label: '駅名を隠す' },
  { value: 'all-hidden', label: '駅名・路線名を隠す' }
]

function isLabelMode(value: unknown): value is RouteLabelMode {
  return value === 'all' || value === 'stations-hidden' || value === 'all-hidden'
}

export function RouteGameTab() {
  const saved = useLiveQuery(() => db.routeSuspension.get('active'), [], null)
  const [startId, setStartId] = useState<StableId>(initialStart)
  const [destinationId, setDestinationId] = useState<StableId>(initialDestination)
  const [path, setPath] = useState<StableId[]>([initialStart])
  const [message, setMessage] = useState('現在駅を確認して、次の駅を選びましょう。')
  const [labelMode, setLabelMode] = useState<RouteLabelMode>('all')
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const [routeExpanded, setRouteExpanded] = useState(false)
  const [view, setView] = useState<'game' | 'history'>('game')
  const [restored, setRestored] = useState(false)
  const historyCount = useLiveQuery(() => db.routeHistory.count(), []) ?? 0

  useEffect(() => {
    if (restored || saved === null) return
    if (saved && saved.datasetVersion === demoNetwork.version && isValidPath(demoNetwork, saved.path)) {
      setStartId(saved.startId)
      setDestinationId(saved.destinationId)
      setPath(saved.path)
      if (isLabelMode(saved.labelMode)) setLabelMode(saved.labelMode)
      if ([0, 1, 2, 3].includes(saved.hintLevel ?? -1)) setHintLevel(saved.hintLevel as HintLevel)
      setRouteExpanded(saved.routeExpanded ?? false)
      setMessage('前回の続きから再開しました。')
    }
    setRestored(true)
  }, [saved, restored])

  useEffect(() => {
    if (!restored) return
    void db.routeSuspension.put({
      id: 'active', startId, destinationId, path, labelMode, hintLevel, routeExpanded,
      datasetVersion: demoNetwork.version, updatedAt: new Date().toISOString()
    })
  }, [startId, destinationId, path, labelMode, hintLevel, routeExpanded, restored])

  const currentId = path[path.length - 1]
  const candidates = getNeighbors(demoNetwork, currentId)
  const arrived = currentId === destinationId
  const metrics = useMemo(() => calculateMetrics(demoNetwork, path), [path])
  const hideStationNames = labelMode !== 'all'
  const hideLineNames = labelMode === 'all-hidden'
  const hintText = getHintText(demoNetwork, currentId, destinationId, hintLevel)

  const stationLabel = (stationId: StableId, routeIndex?: number) => {
    const stationName = getStation(demoNetwork, stationId)?.canonicalName ?? '不明な駅'
    if (!hideStationNames || stationId === startId || stationId === destinationId) return stationName
    return routeIndex === undefined ? '駅名を隠しています' : `経路の駅 ${routeIndex + 1}`
  }

  const lineLabel = (lineId: StableId) => {
    const index = demoNetwork.lines.findIndex((line) => line.stableId === lineId)
    if (hideLineNames) return `路線 ${index + 1}`
    return demoNetwork.lines[index]?.name ?? '路線'
  }

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
    setHintLevel(0)
    setRouteExpanded(false)
    setMessage('新しい経路を開始しました。')
  }

  const confirm = async () => {
    if (!arrived) return
    await db.routeHistory.add({
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), datasetVersion: demoNetwork.version,
      path, lineIds: getRouteLineIds(demoNetwork, path), metrics
    })
    await db.routeSuspension.delete('active')
    restart()
    setMessage('経路を記録しました。もう一度挑戦できます。')
  }

  const revealNextHint = () => {
    setHintLevel((level) => level === 3 ? 0 : (level + 1) as HintLevel)
  }

  return (
    <section className="screen" aria-labelledby="route-title">
      <header className="screen-heading">
        <div><span className="eyebrow">組み立てる・振り返る</span><h1 id="route-title">経路</h1></div>
        <span className="data-pill">記録 {historyCount}件</span>
      </header>
      <div className="route-section-tabs" aria-label="経路メニュー">
        <button className={view === 'game' ? 'active' : ''} aria-current={view === 'game' ? 'page' : undefined} onClick={() => setView('game')}><Gamepad2 size={17} aria-hidden="true" />ゲーム</button>
        <button className={view === 'history' ? 'active' : ''} aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}><History size={17} aria-hidden="true" />履歴</button>
      </div>
      {view === 'history' ? <RouteHistoryView /> : <>
      {hideStationNames ? (
        <div className="hidden-route-endpoints">
          <span><small>出発駅</small><strong>{getStation(demoNetwork, startId)?.canonicalName}</strong></span>
          <ArrowRight size={18} aria-hidden="true" />
          <span><small>目的駅</small><strong>{getStation(demoNetwork, destinationId)?.canonicalName}</strong></span>
          <p>出発駅・目的駅を変更するときは「すべて表示」に戻してください。</p>
        </div>
      ) : (
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
      )}
      <div className="label-mode" aria-label="地図の表示方法">
        {labelModes.map((mode) => (
          <button key={mode.value} className={labelMode === mode.value ? 'active' : ''} onClick={() => setLabelMode(mode.value)}>{mode.label}</button>
        ))}
      </div>
      <RailMap
        selectedStationId={currentId}
        destinationId={destinationId}
        route={path}
        candidateIds={candidates.map((candidate) => candidate.stationId)}
        hideStationNames={hideStationNames}
        hideLineNames={hideLineNames}
        alwaysVisibleStationIds={[startId, destinationId]}
        onSelectStation={move}
      />
      <div className="game-status" aria-live="polite"><Flag size={17} aria-hidden="true" /><span>{message}</span></div>
      <article className="route-panel">
        <div className="route-panel__heading">
          <div><span className="eyebrow">現在駅</span><h2>{stationLabel(currentId)}</h2></div>
          <button className="icon-button" disabled={path.length <= 1} onClick={() => { setPath((value) => value.slice(0, -1)); setMessage('直前の1操作を戻しました。') }}>
            <Undo2 size={18} aria-hidden="true" />1操作戻す
          </button>
        </div>
        <div className="metric-row">
          <span><strong>{metrics.railSegments}</strong> 駅間</span>
          <span><strong>{metrics.transfers}</strong> 乗換</span>
          <span><strong>{metrics.revisits}</strong> 再訪</span>
        </div>
        <div className="route-overview">
          <List size={18} aria-hidden="true" />
          <span><strong>経路 {path.length}駅</strong><small>{routeExpanded ? '一覧を閉じる' : '通った順番を見る'}</small></span>
          <button aria-label={routeExpanded ? '経路一覧を閉じる' : '経路一覧を開く'} aria-expanded={routeExpanded} onClick={() => setRouteExpanded((value) => !value)}><ChevronDown size={18} aria-hidden="true" /></button>
        </div>
        {routeExpanded && (
          <ol className="route-list">
            {path.map((stationId, index) => (
              <li key={`${stationId}-${index}`}>
                <span><b>{index + 1}</b>{stationLabel(stationId, index)}</span>
                {index < path.length - 1 && <button onClick={() => { setPath(path.slice(0, index + 1)); setHintLevel(0); setMessage('選んだ地点から経路を組み直します。') }}><Scissors size={14} aria-hidden="true" />ここから組み直す</button>}
              </li>
            ))}
          </ol>
        )}
        <div className="hint-box">
          <button onClick={revealNextHint}><Lightbulb size={17} aria-hidden="true" />{hintLevel === 0 ? 'ヒントを見る' : hintLevel === 3 ? 'ヒントを閉じる' : `ヒント ${hintLevel + 1}を見る`}</button>
          <span>ヒントを使っても減点はありません。</span>
          {hintText && <p aria-live="polite"><strong>ヒント {hintLevel}</strong>{hintText}</p>}
        </div>
        <h3>次に進める駅</h3>
        <div className="candidate-list">
          {candidates.map(({ stationId, edge }, index) => {
            const line = demoNetwork.lines.find((item) => item.stableId === edge.lineId)!
            return <button key={stationId} onClick={() => move(stationId)}><i style={{ background: line.color }} /><span>{hideStationNames ? `候補 ${index + 1}` : getStation(demoNetwork, stationId)?.canonicalName}</span><small>{lineLabel(line.stableId)}</small></button>
          })}
        </div>
        {arrived && <button className="primary-button confirm-button" onClick={confirm}><CheckCircle2 size={19} aria-hidden="true" />この経路で確定</button>}
        <button className="text-button" onClick={() => restart()}><RotateCcw size={16} aria-hidden="true" />最初からやり直す</button>
      </article>
      </>}
    </section>
  )
}
