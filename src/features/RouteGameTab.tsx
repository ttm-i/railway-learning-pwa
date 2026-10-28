import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, CheckCircle2, ChevronDown, Eye, EyeOff, Flag, Gamepad2, History, Lightbulb, List, LocateFixed, RotateCcw, Scissors, Search, Undo2 } from 'lucide-react'
import { fullMapViewport, normalizeMapViewport, RailMap, type MapViewport } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { calculateMetrics, getNeighbors, getStation, isValidPath } from '../domain/graph'
import { getHintText, getOrderedViaProgress, type HintLevel, type RouteLabelMode } from '../domain/routeGame'
import { getRouteLineIds } from '../domain/routeHistory'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'
import { RouteHistoryView } from './RouteHistoryView'
import { RouteSearchView, type RouteSearchGameConditions } from './RouteSearchView'

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
  const [showDestinationMarker, setShowDestinationMarker] = useState(true)
  const [viaIds, setViaIds] = useState<StableId[]>([])
  const [excludedLineIds, setExcludedLineIds] = useState<StableId[]>([])
  const [view, setView] = useState<'game' | 'search' | 'history'>('game')
  const [mapViewport, setMapViewport] = useState<MapViewport>(fullMapViewport)
  const [autoFollow, setAutoFollow] = useState(true)
  const [candidatesVisible, setCandidatesVisible] = useState(false)
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
      setShowDestinationMarker(saved.showDestinationMarker ?? true)
      setViaIds(saved.viaIds ?? [])
      setExcludedLineIds(saved.excludedLineIds ?? [])
      setMessage('前回の続きから再開しました。')
    }
    setRestored(true)
  }, [saved, restored])

  useEffect(() => {
    if (!restored) return
    void db.routeSuspension.put({
      id: 'active', startId, destinationId, path, labelMode, hintLevel, routeExpanded, showDestinationMarker, viaIds, excludedLineIds,
      datasetVersion: demoNetwork.version, updatedAt: new Date().toISOString()
    })
  }, [startId, destinationId, path, labelMode, hintLevel, routeExpanded, showDestinationMarker, viaIds, excludedLineIds, restored])

  const currentId = path[path.length - 1]
  const candidates = getNeighbors(demoNetwork, currentId).filter(({ edge }) => !excludedLineIds.includes(edge.lineId))
  const viaProgress = getOrderedViaProgress(path, viaIds)
  const arrived = currentId === destinationId && viaProgress === viaIds.length
  const metrics = useMemo(() => calculateMetrics(demoNetwork, path), [path])
  const hideStationNames = labelMode !== 'all'
  const hideLineNames = labelMode === 'all-hidden'
  const hintTargetId = viaIds[viaProgress] ?? destinationId
  const hintText = getHintText(demoNetwork, currentId, hintTargetId, hintLevel, excludedLineIds)

  useEffect(() => {
    if (!autoFollow) return
    const currentStation = getStation(demoNetwork, currentId)
    if (!currentStation) return
    setMapViewport((current) => normalizeMapViewport({ ...current, centerX: currentStation.x, centerY: currentStation.y }))
  }, [currentId, autoFollow])

  useEffect(() => {
    setCandidatesVisible(false)
  }, [currentId])

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
    const nextPath = [...path, stationId]
    const nextViaProgress = getOrderedViaProgress(nextPath, viaIds)
    setPath(nextPath)
    if (stationId === destinationId && nextViaProgress === viaIds.length) {
      setMessage('目的地に到着しました。内容を確認して確定してください。')
    } else if (stationId === destinationId) {
      setMessage('目的地を通りましたが、まだ指定された経由駅が残っています。')
    } else if (nextViaProgress > viaProgress) {
      setMessage(`経由駅 ${nextViaProgress} / ${viaIds.length} を通過しました。`)
    } else {
      setMessage('次の駅へ進みました。')
    }
  }

  const selectStationOnMap = (stationId: StableId) => {
    if (stationId === currentId) {
      setCandidatesVisible(true)
      setMessage(candidates.length > 0
        ? `次に進める駅を${candidates.length}件表示しました。`
        : '現在の条件では、この駅から進めません。')
      return
    }
    if (!candidatesVisible) {
      setMessage('まず地図の現在駅をタップして、次に進める駅を表示してください。')
      return
    }
    move(stationId)
  }

  const restart = (nextStart = startId, nextDestination = destinationId) => {
    setPath([nextStart])
    setHintLevel(0)
    setRouteExpanded(false)
    setMapViewport(fullMapViewport)
    setAutoFollow(true)
    setCandidatesVisible(false)
    setMessage('新しい経路を開始しました。')
  }

  const confirm = async () => {
    if (!arrived) return
    await db.routeHistory.add({
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), datasetVersion: demoNetwork.version,
      path, lineIds: getRouteLineIds(demoNetwork, path), viaIds, excludedLineIds, metrics
    })
    await db.routeSuspension.delete('active')
    restart()
    setMessage('経路を記録しました。もう一度挑戦できます。')
  }

  const revealNextHint = () => {
    setHintLevel((level) => level === 3 ? 0 : (level + 1) as HintLevel)
  }

  const startFromSearch = (conditions: RouteSearchGameConditions) => {
    setStartId(conditions.startId)
    setDestinationId(conditions.destinationId)
    setViaIds(conditions.viaIds)
    setExcludedLineIds(conditions.excludedLineIds)
    setPath([conditions.startId])
    setHintLevel(0)
    setRouteExpanded(false)
    setMapViewport(fullMapViewport)
    setAutoFollow(true)
    setCandidatesVisible(false)
    setMessage('検索条件を引き継ぎました。検索結果は隠しています。')
    setView('game')
  }

  const returnToCurrentStation = () => {
    const currentStation = getStation(demoNetwork, currentId)
    if (!currentStation) return
    setMapViewport((current) => normalizeMapViewport({ ...current, centerX: currentStation.x, centerY: currentStation.y }))
    setAutoFollow(true)
  }

  return (
    <section className="screen" aria-labelledby="route-title">
      <header className="screen-heading">
        <div><span className="eyebrow">組み立てる・振り返る</span><h1 id="route-title">経路</h1></div>
        <span className="data-pill">記録 {historyCount}件</span>
      </header>
      <div className="route-section-tabs" aria-label="経路メニュー">
        <button className={view === 'game' ? 'active' : ''} aria-current={view === 'game' ? 'page' : undefined} onClick={() => setView('game')}><Gamepad2 size={17} aria-hidden="true" />ゲーム</button>
        <button className={view === 'search' ? 'active' : ''} aria-current={view === 'search' ? 'page' : undefined} onClick={() => setView('search')}><Search size={17} aria-hidden="true" />検索</button>
        <button className={view === 'history' ? 'active' : ''} aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}><History size={17} aria-hidden="true" />履歴</button>
      </div>
      {view === 'history' ? <RouteHistoryView /> : view === 'search' ? <RouteSearchView onStartGame={startFromSearch} /> : <>
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
            <select value={startId} onChange={(event) => { const id = event.target.value as StableId; setStartId(id); setViaIds([]); setExcludedLineIds([]); restart(id, destinationId) }}>
              {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
            </select>
          </label>
          <ArrowRight size={18} aria-hidden="true" />
          <label>目的駅
            <select value={destinationId} onChange={(event) => { const id = event.target.value as StableId; setDestinationId(id); setViaIds([]); setExcludedLineIds([]); restart(startId, id) }}>
              {demoNetwork.stations.map((station) => <option value={station.stableId} key={station.stableId}>{station.canonicalName}</option>)}
            </select>
          </label>
        </div>
      )}
      {(viaIds.length > 0 || excludedLineIds.length > 0) && (
        <div className="game-conditions">
          <div><strong>引き継いだ条件</strong><span>検索結果の経路そのものは表示していません。</span></div>
          {viaIds.length > 0 && <p><b>経由</b>{viaIds.map((id, index) => <span className={index < viaProgress ? 'done' : ''} key={id}>{index + 1}. {getStation(demoNetwork, id)?.canonicalName}</span>)}</p>}
          {excludedLineIds.length > 0 && <p><b>使わない路線</b>{excludedLineIds.map((id) => <span key={id}>{demoNetwork.lines.find((line) => line.stableId === id)?.name}</span>)}</p>}
          <button onClick={() => { setViaIds([]); setExcludedLineIds([]); setMessage('経由・除外条件を解除しました。') }}>条件を解除</button>
        </div>
      )}
      <div className="label-mode" aria-label="地図の表示方法">
        {labelModes.map((mode) => (
          <button key={mode.value} className={labelMode === mode.value ? 'active' : ''} onClick={() => setLabelMode(mode.value)}>{mode.label}</button>
        ))}
      </div>
      <button
        type="button"
        className={`destination-marker-toggle ${showDestinationMarker ? 'active' : ''}`}
        aria-pressed={showDestinationMarker}
        onClick={() => setShowDestinationMarker((value) => !value)}
      >
        {showDestinationMarker ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
        目的駅の印：{showDestinationMarker ? '表示中' : '非表示'}
      </button>
      <div className="route-game-map">
        <RailMap
          selectedStationId={currentId}
          destinationId={showDestinationMarker ? destinationId : undefined}
          route={path}
          candidateIds={candidatesVisible ? candidates.map((candidate) => candidate.stationId) : []}
          hideStationNames={hideStationNames}
          hideLineNames={hideLineNames}
          alwaysVisibleStationIds={[startId, destinationId]}
          onSelectStation={selectStationOnMap}
          interactiveViewport
          viewport={mapViewport}
          onViewportChange={setMapViewport}
          onViewportCommit={() => setAutoFollow(false)}
        />
        <button
          type="button"
          className={`current-station-button ${autoFollow ? 'following' : 'paused'}`}
          aria-pressed={autoFollow}
          onClick={returnToCurrentStation}
        >
          <LocateFixed size={17} aria-hidden="true" />
          {autoFollow ? '現在駅を表示中' : '現在駅へ戻る'}
        </button>
      </div>
      <div className="game-status" aria-live="polite"><Flag size={17} aria-hidden="true" /><span>{message}</span></div>
      <article className="route-panel">
        <div className="route-panel__heading">
          <div><span className="eyebrow">現在駅</span><h2>{stationLabel(currentId)}</h2></div>
          <button className="icon-button" disabled={path.length <= 1} onClick={() => { setPath((value) => value.slice(0, -1)); setCandidatesVisible(false); setMessage('直前の1操作を戻しました。') }}>
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
                {index < path.length - 1 && <button onClick={() => { setPath(path.slice(0, index + 1)); setHintLevel(0); setCandidatesVisible(false); setMessage('選んだ地点から経路を組み直します。') }}><Scissors size={14} aria-hidden="true" />ここから組み直す</button>}
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
        {!candidatesVisible ? <p className="candidate-reveal-prompt">地図上の現在駅をタップすると、次に進める駅が地図と一覧に表示されます。</p> : candidates.length === 0 ? <p className="game-no-candidates">現在の除外条件では、この駅から進めません。条件を解除するか1操作戻してください。</p> : <div className="candidate-list">
          {candidates.map(({ stationId, edge }, index) => {
            const line = demoNetwork.lines.find((item) => item.stableId === edge.lineId)!
            return <button key={stationId} onClick={() => move(stationId)}><i style={{ background: line.color }} /><span>{hideStationNames ? `候補 ${index + 1}` : `${index + 1}. ${getStation(demoNetwork, stationId)?.canonicalName}`}</span><small>{lineLabel(line.stableId)}</small></button>
          })}
        </div>}
        {arrived && <button className="primary-button confirm-button" onClick={confirm}><CheckCircle2 size={19} aria-hidden="true" />この経路で確定</button>}
        <button className="text-button" onClick={() => restart()}><RotateCcw size={16} aria-hidden="true" />最初からやり直す</button>
      </article>
      </>}
    </section>
  )
}
