import type { DemoDataset, StableId, Station } from './types'

export interface LabelViewport {
  minX: number
  minY: number
  width: number
  height: number
  zoom: number
}

export interface StationLabelPlacement {
  stationId: StableId
  x: number
  y: number
  textAnchor: 'start' | 'middle' | 'end'
}

interface LabelBox {
  left: number
  top: number
  right: number
  bottom: number
}

interface PlacementOption extends StationLabelPlacement {
  box: LabelBox
}

const labelWidth = (station: Station) => Math.max(30, station.canonicalName.length * 12 + 8)

function placementOptions(station: Station): PlacementOption[] {
  const width = labelWidth(station)
  const height = 15
  const options: Array<{ x: number; y: number; textAnchor: StationLabelPlacement['textAnchor'] }> = [
    { x: station.x, y: station.y - 16, textAnchor: 'middle' },
    { x: station.x, y: station.y + 25, textAnchor: 'middle' },
    { x: station.x + 14, y: station.y + 4, textAnchor: 'start' },
    { x: station.x - 14, y: station.y + 4, textAnchor: 'end' }
  ]

  return options.map((option) => {
    const left = option.textAnchor === 'middle' ? option.x - width / 2 : option.textAnchor === 'end' ? option.x - width : option.x
    return {
      stationId: station.stableId,
      ...option,
      box: { left, top: option.y - 12, right: left + width, bottom: option.y + height - 12 }
    }
  })
}

const boxesOverlap = (first: LabelBox, second: LabelBox) => !(
  first.right + 3 <= second.left ||
  first.left >= second.right + 3 ||
  first.bottom + 3 <= second.top ||
  first.top >= second.bottom + 3
)

export function layoutMapLabels(
  dataset: DemoDataset,
  viewport: LabelViewport,
  selectedStationId?: StableId,
  selectedLineId?: StableId
): StationLabelPlacement[] {
  const maxX = viewport.minX + viewport.width
  const maxY = viewport.minY + viewport.height
  const stationLineCounts = new Map<StableId, number>()
  dataset.lines.forEach((line) => line.stationIds.forEach((stationId) => {
    stationLineCounts.set(stationId, (stationLineCounts.get(stationId) ?? 0) + 1)
  }))
  const endpointIds = new Set(dataset.lines.flatMap((line) => [line.stationIds[0], line.stationIds.at(-1)!]))
  const selectedLineStationIds = new Set(dataset.lines.find((line) => line.stableId === selectedLineId)?.stationIds ?? [])
  const isImportant = (stationId: StableId) => (
    stationId === selectedStationId ||
    selectedLineStationIds.has(stationId) ||
    (stationLineCounts.get(stationId) ?? 0) > 1 ||
    endpointIds.has(stationId)
  )
  const priority = (stationId: StableId) => {
    if (stationId === selectedStationId) return 0
    if (selectedLineStationIds.has(stationId)) return 1
    if ((stationLineCounts.get(stationId) ?? 0) > 1) return 2
    if (endpointIds.has(stationId)) return 3
    return 4
  }

  const candidates = dataset.stations
    .filter((station) => station.x >= viewport.minX && station.x <= maxX && station.y >= viewport.minY && station.y <= maxY)
    .filter((station) => viewport.zoom >= 1.3 || isImportant(station.stableId))
    .sort((first, second) => priority(first.stableId) - priority(second.stableId))

  const occupied: LabelBox[] = []
  const placements: StationLabelPlacement[] = []
  candidates.forEach((station) => {
    const options = placementOptions(station)
    const insideViewport = (option: PlacementOption) => (
      option.box.left >= viewport.minX + 3 && option.box.right <= maxX - 3 &&
      option.box.top >= viewport.minY + 3 && option.box.bottom <= maxY - 3
    )
    const chosen = options.find((option) => insideViewport(option) && occupied.every((box) => !boxesOverlap(option.box, box)))
    if (!chosen) return
    occupied.push(chosen.box)
    placements.push({ stationId: chosen.stationId, x: chosen.x, y: chosen.y, textAnchor: chosen.textAnchor })
  })

  return placements
}
