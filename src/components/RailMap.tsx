import type { StableId } from '../domain/types'
import { demoNetwork } from '../data/demoNetwork'
import { findEdge } from '../domain/graph'

interface RailMapProps {
  selectedStationId?: StableId
  selectedLineId?: StableId
  route?: StableId[]
  destinationId?: StableId
  candidateIds?: StableId[]
  hideStationNames?: boolean
  hideLineNames?: boolean
  alwaysVisibleStationIds?: StableId[]
  onSelectStation?: (stationId: StableId) => void
}

export function RailMap({
  selectedStationId,
  selectedLineId,
  route = [],
  destinationId,
  candidateIds = [],
  hideStationNames = false,
  hideLineNames = false,
  alwaysVisibleStationIds = [],
  onSelectStation
}: RailMapProps) {
  const routePairs = route.slice(1).map((to, index) => ({ from: route[index], to }))

  return (
    <div className="map-frame">
      <svg className="rail-map" viewBox="0 0 400 350" role="img" aria-label="架空路線図">
        <rect width="400" height="350" rx="28" className="map-background" />
        <path d="M18 300 C95 255 88 212 160 194 C250 172 290 120 388 54" className="river" />
        {demoNetwork.edges.map((edge) => {
          const from = demoNetwork.stations.find((station) => station.stableId === edge.from)!
          const to = demoNetwork.stations.find((station) => station.stableId === edge.to)!
          const line = demoNetwork.lines.find((item) => item.stableId === edge.lineId)!
          return (
            <line
              key={edge.stableId}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={line.color}
              className={`rail-line ${selectedLineId === line.stableId ? 'selected-line' : ''}`}
            />
          )
        })}
        {routePairs.map(({ from, to }, index) => {
          const fromStation = demoNetwork.stations.find((station) => station.stableId === from)!
          const toStation = demoNetwork.stations.find((station) => station.stableId === to)!
          const edge = findEdge(demoNetwork, from, to)
          return edge ? (
            <line
              key={`${from}-${to}-${index}`}
              x1={fromStation.x}
              y1={fromStation.y}
              x2={toStation.x}
              y2={toStation.y}
              className="route-highlight"
            />
          ) : null
        })}
        {demoNetwork.stations.map((station) => {
          const isSelected = selectedStationId === station.stableId
          const isDestination = destinationId === station.stableId
          const isCandidate = candidateIds.includes(station.stableId)
          const isInRoute = route.includes(station.stableId)
          const candidateNumber = isCandidate ? candidateIds.indexOf(station.stableId) + 1 : null
          const keepName = alwaysVisibleStationIds.includes(station.stableId)
          const visibleLabel = hideStationNames
            ? keepName
              ? candidateNumber ? `${candidateNumber} ${station.canonicalName}` : station.canonicalName
              : candidateNumber ? String(candidateNumber) : ''
            : station.canonicalName
          const accessibleLabel = hideStationNames
            ? keepName
              ? `${station.canonicalName}駅${candidateNumber ? `、候補 ${candidateNumber}` : ''}`
              : candidateNumber ? `候補 ${candidateNumber}` : '駅（名前を非表示）'
            : `${station.canonicalName}駅`
          return (
            <g
              key={station.stableId}
              className="station-target"
              role="button"
              tabIndex={0}
              aria-label={`${accessibleLabel}${isCandidate ? '、次に進めます' : ''}`}
              onClick={() => onSelectStation?.(station.stableId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectStation?.(station.stableId)
              }}
            >
              {isDestination && <circle cx={station.x} cy={station.y} r="16" className="destination-ring" />}
              {isCandidate && <circle cx={station.x} cy={station.y} r="14" className="candidate-ring" />}
              <circle
                cx={station.x}
                cy={station.y}
                r={isSelected ? 9 : 7}
                className={`station-dot ${isSelected ? 'selected' : ''} ${isInRoute ? 'in-route' : ''}`}
              />
              {visibleLabel && <text x={station.x} y={station.y - 16} textAnchor="middle" className="station-label">{visibleLabel}</text>}
            </g>
          )
        })}
      </svg>
      <div className="map-legend" aria-label="路線凡例">
        {demoNetwork.lines.map((line, index) => (
          <span key={line.stableId}><i style={{ background: line.color }} />{hideLineNames ? `路線 ${index + 1}` : line.name}</span>
        ))}
      </div>
    </div>
  )
}
