import type { DemoDataset, RailEdge, RouteMetrics, StableId } from './types'

export function getStation(dataset: DemoDataset, stationId: StableId) {
  return dataset.stations.find((station) => station.stableId === stationId)
}

export function getLine(dataset: DemoDataset, lineId: StableId) {
  return dataset.lines.find((line) => line.stableId === lineId)
}

export function findEdge(dataset: DemoDataset, from: StableId, to: StableId): RailEdge | undefined {
  return dataset.edges.find(
    (edge) =>
      edge.confirmationStatus === 'confirmed' &&
      ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))
  )
}

export function getNeighbors(dataset: DemoDataset, stationId: StableId) {
  return dataset.edges.flatMap((edge) => {
    if (edge.confirmationStatus !== 'confirmed') return []
    if (edge.from === stationId) return [{ stationId: edge.to, edge }]
    if (edge.to === stationId) return [{ stationId: edge.from, edge }]
    return []
  })
}

export function isValidPath(dataset: DemoDataset, path: StableId[]) {
  return path.length > 0 && path.slice(1).every((stationId, index) => Boolean(findEdge(dataset, path[index], stationId)))
}

export function calculateMetrics(dataset: DemoDataset, path: StableId[]): RouteMetrics {
  const edges = path.slice(1).map((stationId, index) => findEdge(dataset, path[index], stationId))
  const transfers = edges.slice(1).reduce((count, current, index) => {
    const previous = edges[index]
    return count + (previous && current && previous.lineId !== current.lineId ? 1 : 0)
  }, 0)
  const seen = new Set<StableId>()
  let revisits = 0
  path.forEach((stationId) => {
    if (seen.has(stationId)) revisits += 1
    seen.add(stationId)
  })

  return {
    transfers,
    railSegments: edges.filter(Boolean).length,
    revisits,
    walks: 0
  }
}

export function validateDataset(dataset: DemoDataset): string[] {
  const errors: string[] = []
  const stationIds = new Set(dataset.stations.map((station) => station.stableId))
  if (stationIds.size !== dataset.stations.length) errors.push('駅IDが重複しています。')
  dataset.lines.forEach((line) => {
    line.stationIds.forEach((stationId) => {
      if (!stationIds.has(stationId)) errors.push(`${line.name}に存在しない駅IDがあります。`)
    })
  })
  dataset.edges.forEach((edge) => {
    if (!stationIds.has(edge.from) || !stationIds.has(edge.to)) errors.push(`${edge.stableId}の駅参照が切れています。`)
  })
  return errors
}
