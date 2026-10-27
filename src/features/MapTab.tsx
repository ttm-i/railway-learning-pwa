import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronDown, ChevronUp, MapPinned, Search, TrainFront, X } from 'lucide-react'
import { fullMapViewport, normalizeMapViewport, RailMap, type MapViewport } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { getLine, getNeighbors, getStation } from '../domain/graph'
import { searchNetwork } from '../domain/search'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

type SheetLevel = 'peek' | 'half' | 'full'

const sheetLevels: SheetLevel[] = ['peek', 'half', 'full']
const sheetLevelNames: Record<SheetLevel, string> = { peek: '小', half: '中', full: '大' }

export function MapTab() {
  const [selectedId, setSelectedId] = useState<StableId>('demo:station:midori')
  const [selectedLineId, setSelectedLineId] = useState<StableId | undefined>()
  const [query, setQuery] = useState('')
  const [viewport, setViewport] = useState<MapViewport>(fullMapViewport)
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>('peek')
  const [sheetDragOffset, setSheetDragOffset] = useState(0)
  const sheetDragOffsetRef = useRef(0)
  const sheetDragStart = useRef<{ pointerId: number; y: number } | null>(null)
  const restoredViewport = useRef(false)
  const savedViewport = useLiveQuery(() => db.settings.get('mapViewport'), [])
  const station = getStation(demoNetwork, selectedId)!
  const neighbors = getNeighbors(demoNetwork, selectedId)
  const mastery = useLiveQuery(() => db.manualMastery.get(selectedId), [selectedId])
  const lines = demoNetwork.lines.filter((line) => line.stationIds.includes(selectedId))
  const selectedLine = selectedLineId ? getLine(demoNetwork, selectedLineId) : undefined
  const selectedOperator = selectedLine ? demoNetwork.operators.find((operator) => operator.stableId === selectedLine.operatorId) : undefined
  const lineTransferStations = selectedLine?.stationIds.filter((stationId) => demoNetwork.lines.filter((line) => line.stationIds.includes(stationId)).length > 1) ?? []
  const searchResults = searchNetwork(demoNetwork, query)

  useEffect(() => {
    if (restoredViewport.current || savedViewport === undefined) return
    restoredViewport.current = true
    const value = savedViewport?.value
    if (!value || typeof value !== 'object') return
    const candidate = value as Partial<MapViewport>
    if ([candidate.centerX, candidate.centerY, candidate.zoom].every((item) => typeof item === 'number' && Number.isFinite(item))) {
      setViewport(normalizeMapViewport(candidate as MapViewport))
    }
  }, [savedViewport])

  const saveViewport = (next: MapViewport) => {
    void db.settings.put({ key: 'mapViewport', value: next })
  }

  const selectStation = (stationId: StableId, openSheet = true) => {
    setSelectedId(stationId)
    setSelectedLineId(undefined)
    setQuery('')
    if (openSheet) setSheetLevel('half')
  }

  const selectLine = (lineId: StableId, showWholeLine = true) => {
    const line = getLine(demoNetwork, lineId)
    if (!line) return
    setSelectedLineId(lineId)
    if (!line.stationIds.includes(selectedId)) setSelectedId(line.stationIds[0])
    if (showWholeLine) {
      setViewport(fullMapViewport)
      saveViewport(fullMapViewport)
    }
    setSheetLevel('half')
    setQuery('')
  }

  const selectSearchStation = (stationId: StableId) => {
    const result = getStation(demoNetwork, stationId)
    selectStation(stationId)
    if (!result) return
    const focused = normalizeMapViewport({ centerX: result.x, centerY: result.y, zoom: 1.8 })
    setViewport(focused)
    saveViewport(focused)
  }

  const toggleMastery = async () => {
    await db.manualMastery.put({ stationId: selectedId, learned: !mastery?.learned, updatedAt: new Date().toISOString() })
  }

  const changeSheetLevel = (direction: -1 | 1) => {
    const currentIndex = sheetLevels.indexOf(sheetLevel)
    const nextIndex = Math.min(sheetLevels.length - 1, Math.max(0, currentIndex + direction))
    setSheetLevel(sheetLevels[nextIndex])
  }

  const beginSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    sheetDragStart.current = { pointerId: event.pointerId, y: event.clientY }
    sheetDragOffsetRef.current = 0
    setSheetDragOffset(0)
  }

  const moveSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = sheetDragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    event.preventDefault()
    const offset = Math.min(64, Math.max(-64, event.clientY - start.y))
    sheetDragOffsetRef.current = offset
    setSheetDragOffset(offset)
  }

  const endSheetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = sheetDragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    if (sheetDragOffsetRef.current <= -32) changeSheetLevel(1)
    if (sheetDragOffsetRef.current >= 32) changeSheetLevel(-1)
    sheetDragStart.current = null
    sheetDragOffsetRef.current = 0
    setSheetDragOffset(0)
  }

  return (
    <section className="screen" aria-labelledby="map-title">
      <header className="screen-heading">
        <div><span className="eyebrow">見る・触れる</span><h1 id="map-title">路線図</h1></div>
        <span className="data-pill">7駅・2路線</span>
      </header>
      <div className="map-search">
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="駅名・路線名で探す"
          aria-label="駅名・路線名で探す"
        />
        {query && <button aria-label="検索をクリア" onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}
        {query && (
          <div className="search-results" aria-live="polite">
            {searchResults.stations.map((result) => (
              <button key={result.stableId} onClick={() => selectSearchStation(result.stableId)}>
                <MapPinned size={17} aria-hidden="true" /><span><strong>{result.canonicalName}</strong><small>駅</small></span>
              </button>
            ))}
            {searchResults.lines.map((result) => (
              <button key={result.stableId} onClick={() => selectLine(result.stableId)}>
                <i style={{ background: result.color }} /><span><strong>{result.name}</strong><small>路線</small></span>
              </button>
            ))}
            {!searchResults.stations.length && !searchResults.lines.length && <p>一致する駅・路線がありません。</p>}
          </div>
        )}
      </div>
      <div className="map-stage">
        <RailMap
          selectedStationId={selectedId}
          selectedLineId={selectedLineId}
          onSelectStation={selectStation}
          onSelectLine={(lineId) => selectLine(lineId, false)}
          interactiveViewport
          viewport={viewport}
          onViewportChange={setViewport}
          onViewportCommit={saveViewport}
        />
        <article
          className={`detail-card map-detail-sheet level-${sheetLevel}`}
          aria-label={`${selectedLine ? `${selectedLine.name}の路線情報` : `${station.canonicalName}駅の情報`}パネル、${sheetLevelNames[sheetLevel]}サイズ`}
          style={{ transform: `translateY(${sheetDragOffset}px)` }}
        >
          <div
            className="sheet-drag-handle"
            role="separator"
            tabIndex={0}
            aria-label="駅情報パネルの大きさを変更"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={sheetLevels.indexOf(sheetLevel) + 1}
            aria-valuetext={`${sheetLevelNames[sheetLevel]}サイズ`}
            onPointerDown={beginSheetDrag}
            onPointerMove={moveSheetDrag}
            onPointerUp={endSheetDrag}
            onPointerCancel={endSheetDrag}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') changeSheetLevel(1)
              if (event.key === 'ArrowDown') changeSheetLevel(-1)
            }}
          >
            <span />
          </div>
          <div className="detail-card__heading">
            <div className="station-icon">{selectedLine ? <TrainFront size={20} aria-hidden="true" /> : <MapPinned size={20} aria-hidden="true" />}</div>
            <div>
              <span className="eyebrow">{selectedLine ? '選択中の路線' : '選択中の駅'}</span>
              <h2>{selectedLine?.name ?? station.canonicalName}</h2>
            </div>
            <div className="sheet-size-controls" aria-label="駅情報パネルの表示サイズ">
              <button type="button" onClick={() => changeSheetLevel(-1)} disabled={sheetLevel === 'peek'} aria-label="駅情報パネルを小さくする">
                <ChevronDown size={19} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => changeSheetLevel(1)} disabled={sheetLevel === 'full'} aria-label="駅情報パネルを大きくする">
                <ChevronUp size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="sheet-detail-content">
            {selectedLine ? (
              <div className="line-detail-content">
                <p className="line-operator">{selectedOperator?.displayName}</p>
                <div className="line-endpoints">
                  <div><span>始点</span><strong>{getStation(demoNetwork, selectedLine.stationIds[0])?.canonicalName}</strong></div>
                  <div><span>終点</span><strong>{getStation(demoNetwork, selectedLine.stationIds.at(-1)!)?.canonicalName}</strong></div>
                </div>
                <div className="line-stop-list">
                  <h3><TrainFront size={17} aria-hidden="true" /> 所属駅（{selectedLine.stationIds.length}駅）</h3>
                  {selectedLine.stationIds.map((stationId, index) => (
                    <button key={stationId} onClick={() => selectStation(stationId)}>
                      <span className="stop-number">{index + 1}</span>
                      <strong>{getStation(demoNetwork, stationId)?.canonicalName}</strong>
                      <small>{lineTransferStations.includes(stationId) ? '乗換駅' : index === 0 ? '始点' : index === selectedLine.stationIds.length - 1 ? '終点' : ''}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button className={`mastery-button ${mastery?.learned ? 'active' : ''}`} onClick={toggleMastery}>
                  <Check size={17} aria-hidden="true" />{mastery?.learned ? '覚えた' : '覚えたにする'}
                </button>
                <div className="line-chips">
                  {lines.map((line) => <button key={line.stableId} onClick={() => selectLine(line.stableId, false)}><i style={{ background: line.color }} />{line.name}</button>)}
                </div>
                <div className="neighbor-list">
                  <h3><TrainFront size={17} aria-hidden="true" /> 隣の駅</h3>
                  {neighbors.map(({ stationId, edge }) => (
                    <button key={stationId} onClick={() => selectStation(stationId)}>
                      <span>{getStation(demoNetwork, stationId)?.canonicalName}</span>
                      <small>{getLine(demoNetwork, edge.lineId)?.name}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
