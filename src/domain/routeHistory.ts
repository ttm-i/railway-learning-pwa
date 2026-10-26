import { findEdge, getStation } from './graph'
import type { DemoDataset, StableId } from './types'

export function getRouteLineIds(dataset: DemoDataset, path: StableId[]) {
  const lineIds: StableId[] = []
  path.slice(1).forEach((stationId, index) => {
    const lineId = findEdge(dataset, path[index], stationId)?.lineId
    if (lineId && !lineIds.includes(lineId)) lineIds.push(lineId)
  })
  return lineIds
}

export function matchesRouteQuery(dataset: DemoDataset, path: StableId[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('ja')
  if (!normalized) return true

  const stationNames = path.map((stationId) => getStation(dataset, stationId)?.canonicalName ?? '')
  const lineNames = getRouteLineIds(dataset, path).map(
    (lineId) => dataset.lines.find((line) => line.stableId === lineId)?.name ?? ''
  )
  return [...stationNames, ...lineNames].some((name) => name.toLocaleLowerCase('ja').includes(normalized))
}
