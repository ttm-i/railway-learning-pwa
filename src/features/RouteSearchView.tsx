import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowLeftRight, ArrowUp, MapPinned, Play, Plus, X } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { findEdge, getStation } from '../domain/graph'
import { findRouteCandidates } from '../domain/routeSearch'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

interface SavedRouteSearchOptions {
  startId: StableId
  destinationId: StableId
  viaIds: StableId[]
  excludedLineIds?: StableId[]
}

export interface RouteSearchGameConditions {
  startId: StableId
  destinationId: StableId
  viaIds: StableId[]
  excludedLineIds: StableId[]
}

const initialStart: StableId = 'demo:station:harukaze'
const initialDestination: StableId = 'demo:station:hoshimi'
const stationIds = new Set(demoNetwork.stations.map((station) => station.stableId))
const lineIds = new Set(demoNetwork.lines.map((line) => line.stableId))

function isSavedOptions(value: unknown): value is SavedRouteSearchOptions {
  if (!value || typeof value !== 'object') return false
  const options = value as Partial<SavedRouteSearchOptions>
  return Boolean(
    options.startId && stationIds.has(options.startId)
    && options.destinationId && stationIds.has(options.destinationId)
    && Array.isArray(options.viaIds) && options.viaIds.every((id) => stationIds.has(id))
    && (options.excludedLineIds === undefined
      || Array.isArray(options.excludedLineIds) && options.excludedLineIds.every((id) => lineIds.has(id)))
  )
}

export function RouteSearchView({ onStartGame }: { onStartGame?: (conditions: RouteSearchGameConditions) => void }) {
  const saved = useLiveQuery(() => db.settings.get('routeSearchOptions'), [], null)
  const [ready, setReady] = useState(false)
  const [startId, setStartId] = useState<StableId>(initialStart)
  const [destinationId, setDestinationId] = useState<StableId>(initialDestination)
  const [viaIds, setViaIds] = useState<StableId[]>([])
  const [excludedLineIds, setExcludedLineIds] = useState<StableId[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (ready || saved === null) return
    if (isSavedOptions(saved?.value)) {
      setStartId(saved.value.startId)
      setDestinationId(saved.value.destinationId)
      setViaIds(saved.value.viaIds)
      setExcludedLineIds(saved.value.excludedLineIds ?? [])
    }
    setReady(true)
  }, [ready, saved])

  useEffect(() => {
    if (!ready) return
    void db.settings.put({ key: 'routeSearchOptions', value: { startId, destinationId, viaIds, excludedLineIds } })
    setSelectedIndex(0)
  }, [ready, startId, destinationId, viaIds, excludedLineIds])

  const candidates = useMemo(
    () => findRouteCandidates(demoNetwork, startId, destinationId, viaIds, excludedLineIds),
    [startId, destinationId, viaIds, excludedLineIds]
  )
  const selected = candidates[Math.min(selectedIndex, candidates.length - 1)]
  const availableViaStations = demoNetwork.stations.filter(
    (station) => station.stableId !== startId && station.stableId !== destinationId && !viaIds.includes(station.stableId)
  )

  const updateEndpoint = (kind: 'start' | 'destination', id: StableId) => {
    if (kind === 'start') setStartId(id)
    else setDestinationId(id)
    setViaIds((items) => items.filter((item) => item !== id))
  }

  const swapEndpoints = () => {
    setStartId(destinationId)
    setDestinationId(startId)
    setViaIds((items) => [...items].reverse())
  }

  const moveVia = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= viaIds.length) return
    setViaIds((items) => {
      const next = [...items]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  if (!ready) return <div className="loading-card">検索条件を準備しています…</div>

  return (
    <div className="route-search-view">
      <div className="search-endpoints">
        <label>出発駅
          <select value={startId} onChange={(event) => updateEndpoint('start', event.target.value as StableId)}>
            {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
          </select>
        </label>
        <button aria-label="出発駅と目的駅を入れ替える" onClick={swapEndpoints}><ArrowLeftRight size={18} aria-hidden="true" /></button>
        <label>目的駅
          <select value={destinationId} onChange={(event) => updateEndpoint('destination', event.target.value as StableId)}>
            {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
          </select>
        </label>
      </div>

      <div className="via-panel">
        <div className="via-heading"><span><Plus size={16} aria-hidden="true" /><strong>経由駅</strong></span><small>上から順に通ります</small></div>
        {viaIds.length > 0 && <ol>
          {viaIds.map((stationId, index) => <li key={stationId}>
            <b>{index + 1}</b><span>{getStation(demoNetwork, stationId)?.canonicalName}</span>
            <button aria-label={`${getStation(demoNetwork, stationId)?.canonicalName}を上へ`} disabled={index === 0} onClick={() => moveVia(index, -1)}><ArrowUp size={15} aria-hidden="true" /></button>
            <button aria-label={`${getStation(demoNetwork, stationId)?.canonicalName}を下へ`} disabled={index === viaIds.length - 1} onClick={() => moveVia(index, 1)}><ArrowDown size={15} aria-hidden="true" /></button>
            <button aria-label={`${getStation(demoNetwork, stationId)?.canonicalName}を削除`} onClick={() => setViaIds((items) => items.filter((id) => id !== stationId))}><X size={15} aria-hidden="true" /></button>
          </li>)}
        </ol>}
        {availableViaStations.length > 0 ? (
          <select aria-label="経由駅を追加" value="" onChange={(event) => event.target.value && setViaIds((items) => [...items, event.target.value as StableId])}>
            <option value="">経由駅を追加…</option>
            {availableViaStations.map((station) => <option key={station.stableId} value={station.stableId}>{station.canonicalName}</option>)}
          </select>
        ) : <small>追加できる駅はありません。</small>}
      </div>

      <fieldset className="line-exclusions">
        <legend>使わない路線</legend>
        <p>選んだ路線を使わずに検索します。</p>
        {demoNetwork.lines.map((line) => (
          <label key={line.stableId}>
            <input
              type="checkbox"
              checked={excludedLineIds.includes(line.stableId)}
              onChange={(event) => setExcludedLineIds((items) => event.target.checked
                ? [...items, line.stableId]
                : items.filter((id) => id !== line.stableId))}
            />
            <i style={{ background: line.color }} />
            <span>{line.name}</span>
          </label>
        ))}
      </fieldset>

      {startId === destinationId ? (
        <div className="route-search-empty">出発駅と目的駅に別の駅を選んでください。</div>
      ) : candidates.length === 0 ? (
        <div className="route-search-empty">現在の条件では、確認済みの接続だけで経路を見つけられませんでした。</div>
      ) : <>
        <div className="candidate-tabs" aria-label="検索結果の候補">
          {candidates.map((candidate, index) => (
            <button key={candidate.kind} className={selectedIndex === index ? 'active' : ''} onClick={() => setSelectedIndex(index)}>
              {candidate.kind === 'both' ? '両方で同じ候補' : candidate.kind === 'segments' ? '駅間数が少ない候補' : '乗換が少ない候補'}
            </button>
          ))}
        </div>
        {selected && <>
          <RailMap selectedStationId={startId} destinationId={destinationId} route={selected.path} alwaysVisibleStationIds={[startId, destinationId]} />
          <article className="search-result-card">
            <div className="search-result-title"><MapPinned size={19} aria-hidden="true" /><div><span>検索結果</span><h2>{getStation(demoNetwork, startId)?.canonicalName} → {getStation(demoNetwork, destinationId)?.canonicalName}</h2></div></div>
            <div className="history-metrics">
              <span><strong>{selected.metrics.railSegments}</strong>駅間</span>
              <span><strong>{selected.metrics.transfers}</strong>乗換</span>
              <span><strong>{selected.metrics.revisits}</strong>再訪</span>
              <span><strong>{selected.metrics.walks}</strong>徒歩</span>
            </div>
            <ol className="search-route-list">
              {selected.path.map((stationId, index) => {
                const nextId = selected.path[index + 1]
                const edge = nextId ? findEdge(demoNetwork, stationId, nextId) : undefined
                const line = demoNetwork.lines.find((item) => item.stableId === edge?.lineId)
                const previousEdge = index > 0 ? findEdge(demoNetwork, selected.path[index - 1], stationId) : undefined
                const transfer = previousEdge && edge && previousEdge.lineId !== edge.lineId
                return <li key={`${stationId}-${index}`}><b>{index + 1}</b><span>{getStation(demoNetwork, stationId)?.canonicalName}{transfer && <em>乗換</em>}{line && <small>次は {line.name}</small>}</span></li>
              })}
            </ol>
            <p className="search-caution">この架空データで確認済みの接続だけを使用しています。所要時間・料金は推測していません。</p>
            {onStartGame && <button className="primary-button search-to-game" onClick={() => onStartGame({ startId, destinationId, viaIds, excludedLineIds })}><Play size={17} aria-hidden="true" />この条件でゲーム開始</button>}
          </article>
        </>}
      </>}
    </div>
  )
}
