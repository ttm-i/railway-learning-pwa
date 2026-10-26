import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, MapPinned, TrainFront } from 'lucide-react'
import { RailMap } from '../components/RailMap'
import { demoNetwork } from '../data/demoNetwork'
import { getLine, getNeighbors, getStation } from '../domain/graph'
import type { StableId } from '../domain/types'
import { db } from '../storage/db'

export function MapTab() {
  const [selectedId, setSelectedId] = useState<StableId>('demo:station:midori')
  const station = getStation(demoNetwork, selectedId)!
  const neighbors = getNeighbors(demoNetwork, selectedId)
  const mastery = useLiveQuery(() => db.manualMastery.get(selectedId), [selectedId])
  const lines = demoNetwork.lines.filter((line) => line.stationIds.includes(selectedId))

  const toggleMastery = async () => {
    await db.manualMastery.put({ stationId: selectedId, learned: !mastery?.learned, updatedAt: new Date().toISOString() })
  }

  return (
    <section className="screen" aria-labelledby="map-title">
      <header className="screen-heading">
        <div><span className="eyebrow">見る・触れる</span><h1 id="map-title">路線図</h1></div>
        <span className="data-pill">7駅・2路線</span>
      </header>
      <RailMap selectedStationId={selectedId} onSelectStation={setSelectedId} />
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
            <button key={stationId} onClick={() => setSelectedId(stationId)}>
              <span>{getStation(demoNetwork, stationId)?.canonicalName}</span>
              <small>{getLine(demoNetwork, edge.lineId)?.name}</small>
            </button>
          ))}
        </div>
      </article>
    </section>
  )
}
