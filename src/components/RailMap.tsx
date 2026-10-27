import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import type { StableId } from '../domain/types'
import { demoNetwork } from '../data/demoNetwork'
import { findEdge } from '../domain/graph'
import { layoutMapLabels } from '../domain/mapLabels'

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
  onSelectLine?: (lineId: StableId) => void
  interactiveViewport?: boolean
  tallViewport?: boolean
  viewport?: MapViewport
  onViewportChange?: (viewport: MapViewport) => void
  onViewportCommit?: (viewport: MapViewport) => void
}

export interface MapViewport {
  centerX: number
  centerY: number
  zoom: number
}

export const fullMapViewport: MapViewport = { centerX: 200, centerY: 175, zoom: 1 }
export const tallMapViewport: MapViewport = { centerX: 200, centerY: 240, zoom: 1 }

const minZoom = 1
const maxZoom = 2.6
const standardMapHeight = 350
export const tallMapHeight = 480

export function normalizeMapViewport(viewport: MapViewport, mapHeight = standardMapHeight): MapViewport {
  const zoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom))
  const width = 400 / zoom
  const height = mapHeight / zoom
  return {
    zoom,
    centerX: Math.min(400 - width / 2, Math.max(width / 2, viewport.centerX)),
    centerY: Math.min(mapHeight - height / 2, Math.max(height / 2, viewport.centerY))
  }
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
  onSelectStation,
  onSelectLine,
  interactiveViewport = false,
  tallViewport = false,
  viewport = tallViewport ? tallMapViewport : fullMapViewport,
  onViewportChange,
  onViewportCommit
}: RailMapProps) {
  const mapHeight = tallViewport ? tallMapHeight : standardMapHeight
  const normalizedViewport = normalizeMapViewport(viewport, mapHeight)
  const viewportRef = useRef(normalizedViewport)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panStartRef = useRef<{ x: number; y: number; viewport: MapViewport } | undefined>(undefined)
  const pinchStartRef = useRef<{ distance: number; midpointX: number; midpointY: number; viewport: MapViewport } | undefined>(undefined)
  const gestureMovedRef = useRef(false)
  const suppressClickRef = useRef(false)
  const routePairs = route.slice(1).map((to, index) => ({ from: route[index], to }))
  const viewWidth = 400 / normalizedViewport.zoom
  const viewHeight = mapHeight / normalizedViewport.zoom
  const viewBox = `${normalizedViewport.centerX - viewWidth / 2} ${normalizedViewport.centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`
  const stagedLabels = interactiveViewport && !hideStationNames
    ? layoutMapLabels(demoNetwork, {
      minX: normalizedViewport.centerX - viewWidth / 2,
      minY: normalizedViewport.centerY - viewHeight / 2,
      width: viewWidth,
      height: viewHeight,
      zoom: normalizedViewport.zoom
    }, selectedStationId, selectedLineId)
    : []
  const stagedLabelByStation = new Map(stagedLabels.map((label) => [label.stationId, label]))

  viewportRef.current = normalizedViewport

  const changeViewport = (next: MapViewport, commit = false) => {
    const normalized = normalizeMapViewport(next, mapHeight)
    viewportRef.current = normalized
    onViewportChange?.(normalized)
    if (commit) onViewportCommit?.(normalized)
  }

  const zoomBy = (factor: number) => {
    changeViewport({ ...viewportRef.current, zoom: viewportRef.current.zoom * factor }, true)
  }

  const resetViewport = () => changeViewport(tallViewport ? tallMapViewport : fullMapViewport, true)

  const pointerPosition = (event: ReactPointerEvent<SVGSVGElement>) => ({ x: event.clientX, y: event.clientY })

  const beginPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactiveViewport) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointersRef.current.set(event.pointerId, pointerPosition(event))
    gestureMovedRef.current = false
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: event.clientX, y: event.clientY, viewport: viewportRef.current }
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()]
      pinchStartRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        midpointX: (first.x + second.x) / 2,
        midpointY: (first.y + second.y) / 2,
        viewport: viewportRef.current
      }
    }
  }

  const movePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactiveViewport || !pointersRef.current.has(event.pointerId)) return
    event.preventDefault()
    pointersRef.current.set(event.pointerId, pointerPosition(event))
    const rect = event.currentTarget.getBoundingClientRect()
    const pixelWidth = rect.width || 400
    const pixelHeight = rect.height || mapHeight

    if (pointersRef.current.size >= 2 && pinchStartRef.current) {
      const [first, second] = [...pointersRef.current.values()]
      const distance = Math.hypot(second.x - first.x, second.y - first.y)
      const midpointX = (first.x + second.x) / 2
      const midpointY = (first.y + second.y) / 2
      const start = pinchStartRef.current
      if (Math.abs(distance - start.distance) > 3 || Math.abs(midpointX - start.midpointX) > 3 || Math.abs(midpointY - start.midpointY) > 3) {
        gestureMovedRef.current = true
      }
      changeViewport({
        zoom: start.viewport.zoom * (distance / Math.max(start.distance, 1)),
        centerX: start.viewport.centerX - (midpointX - start.midpointX) * (400 / start.viewport.zoom) / pixelWidth,
        centerY: start.viewport.centerY - (midpointY - start.midpointY) * (mapHeight / start.viewport.zoom) / pixelHeight
      })
      return
    }

    const start = panStartRef.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) gestureMovedRef.current = true
    changeViewport({
      ...start.viewport,
      centerX: start.viewport.centerX - dx * (400 / start.viewport.zoom) / pixelWidth,
      centerY: start.viewport.centerY - dy * (mapHeight / start.viewport.zoom) / pixelHeight
    })
  }

  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactiveViewport) return
    pointersRef.current.delete(event.pointerId)
    if (gestureMovedRef.current) {
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 350)
    }
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0]
      panStartRef.current = { x: remaining.x, y: remaining.y, viewport: viewportRef.current }
      pinchStartRef.current = undefined
    } else if (pointersRef.current.size === 0) {
      panStartRef.current = undefined
      pinchStartRef.current = undefined
      onViewportCommit?.(viewportRef.current)
    }
  }

  return (
    <div className={`map-frame ${interactiveViewport ? 'interactive-map' : ''}`}>
      <div className="map-canvas">
      <svg
        className={`rail-map ${tallViewport ? 'tall-rail-map' : ''}`}
        viewBox={viewBox}
        preserveAspectRatio={tallViewport ? 'xMidYMin meet' : undefined}
        role="img"
        aria-label={interactiveViewport ? '架空路線図。1本指で移動、2本指で拡大・縮小できます' : '架空路線図'}
        data-testid="rail-map-svg"
        onPointerDown={beginPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return
          event.preventDefault()
          event.stopPropagation()
          suppressClickRef.current = false
        }}
      >
        <rect width="400" height={mapHeight} rx="28" className="map-background" />
        <path d="M18 300 C95 255 88 212 160 194 C250 172 290 120 388 54" className="river" />
        {demoNetwork.lines.map((line) => {
          const edges = demoNetwork.edges.filter((edge) => edge.lineId === line.stableId)
          return (
            <g
              key={line.stableId}
              className="line-target"
              role={onSelectLine ? 'button' : undefined}
              tabIndex={onSelectLine ? 0 : undefined}
              aria-label={onSelectLine ? `${line.name}を選択` : undefined}
              onClick={() => onSelectLine?.(line.stableId)}
              onKeyDown={(event) => {
                if (onSelectLine && (event.key === 'Enter' || event.key === ' ')) onSelectLine(line.stableId)
              }}
            >
              {edges.map((edge) => {
                const from = demoNetwork.stations.find((station) => station.stableId === edge.from)!
                const to = demoNetwork.stations.find((station) => station.stableId === edge.to)!
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
              {onSelectLine && edges.map((edge) => {
                const from = demoNetwork.stations.find((station) => station.stableId === edge.from)!
                const to = demoNetwork.stations.find((station) => station.stableId === edge.to)!
                return <line key={`${edge.stableId}:hit`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="rail-line-hit" />
              })}
            </g>
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
          const stagedLabel = stagedLabelByStation.get(station.stableId)
          const showLabel = Boolean(visibleLabel && (!interactiveViewport || hideStationNames || stagedLabel))
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
              <circle cx={station.x} cy={station.y} r="18" className="station-hit" />
              {isDestination && <circle cx={station.x} cy={station.y} r="16" className="destination-ring" />}
              {isCandidate && <circle cx={station.x} cy={station.y} r="14" className="candidate-ring" />}
              <circle
                cx={station.x}
                cy={station.y}
                r={isSelected ? 9 : 7}
                className={`station-dot ${isSelected ? 'selected' : ''} ${isInRoute ? 'in-route' : ''}`}
              />
              {showLabel && (
                <text
                  x={stagedLabel?.x ?? station.x}
                  y={stagedLabel?.y ?? station.y - 16}
                  textAnchor={stagedLabel?.textAnchor ?? 'middle'}
                  className="station-label"
                  data-label-station-id={station.stableId}
                >
                  {visibleLabel}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {interactiveViewport && (
        <div className="map-controls" aria-label="地図の表示操作">
          <button type="button" onClick={() => zoomBy(1.35)} aria-label="地図を拡大" disabled={normalizedViewport.zoom >= maxZoom}>
            <Plus size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.35)} aria-label="地図を縮小" disabled={normalizedViewport.zoom <= minZoom}>
            <Minus size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={resetViewport} aria-label="地図全体を表示">
            <LocateFixed size={19} aria-hidden="true" />
          </button>
        </div>
      )}
      {interactiveViewport && <span className="map-zoom-status" aria-live="polite">{Math.round(normalizedViewport.zoom * 100)}%</span>}
      </div>
      <div className="map-legend" aria-label="路線凡例">
        {demoNetwork.lines.map((line, index) => (
          <span key={line.stableId}><i style={{ background: line.color }} />{hideLineNames ? `路線 ${index + 1}` : line.name}</span>
        ))}
      </div>
    </div>
  )
}
