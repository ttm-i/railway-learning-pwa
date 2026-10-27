import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, MapPinned, Search, TrainFront, X } from 'lucide-react'
import { fullMapViewport, normalizeMapViewport, RailMap, type MapViewport } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { getLine, getNeighbors, getStation } from '../domain/graph'
import { searchNetwork } from '../domain/search'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

export function MapTab() {
  const [selectedId, setSelectedId] = useState<StableId>('demo:station:midori')
  const [selectedLineId, setSelectedLineId] = useState<StableId | undefined>()
  const [query, setQuery] = useState('')
  const [viewport, setViewport] = useState<MapViewport>(fullMapViewport)
  const restoredViewport = useRef(false)
  const savedViewport = useLiveQuery(() => db.settings.get('mapViewport'), [])
  const station = getStation(demoNetwork, selectedId)!
  const neighbors = getNeighbors(demoNetwork, selectedId)
  const mastery = useLiveQuery(() => db.manualMastery.get(selectedId), [selectedId])
  const lines = demoNetwork.lines.filter((line) => line.stationIds.includes(selectedId))
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

  const selectStation = (stationId: StableId) => {
    setSelectedId(stationId)
    setSelectedLineId(undefined)
    setQuery('')
  }

  const selectLine = (lineId: StableId) => {
    const line = getLine(demoNetwork, lineId)
    if (!line) return
    setSelectedLineId(lineId)
    setSelectedId(line.stationIds[0])
    setViewport(fullMapViewport)
    saveViewport(fullMapViewport)
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
      <RailMap
        selectedStationId={selectedId}
        selectedLineId={selectedLineId}
        onSelectStation={selectStation}
        interactiveViewport
        viewport={viewport}
        onViewportChange={setViewport}
        onViewportCommit={saveViewport}
      />
      {selectedLineId && (
        <div className="selected-line-banner">
          <span>選択中の路線</span><strong>{getLine(demoNetwork, selectedLineId)?.name}</strong>
          <button onClick={() => setSelectedLineId(undefined)}>強調を解除</button>
        </div>
      )}
      <article className="detail-card">
        <div className="detail-card__heading">
          <div className="station-icon"><MapPinned size={20} aria-hidden="true" /></div>
          <div><span className="eyebrow">選択中の駅</span><h2>{station.canonicalName}</h2></div>
          <button className={`mastery-button ${mastery?.learned ? 'active' : ''}`} onClick={toggleMastery}>
            <Check size={17} aria-hidden="true" />{mastery?.learned ? '覚えた' : '覚えたにする'}
          </button>
        </div>
        <div className="line-chips">
          {lines.map((line) => <span key={line.stableId}><i style={{ background: line.color }} />{line.name}</span>)}
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
      </article>
    </section>
  )
}
