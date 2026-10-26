import { findEdge, getNeighbors, getStation } from './graph'
import type { DemoDataset, StableId } from './types'

export type RouteLabelMode = 'all' | 'stations-hidden' | 'all-hidden'
export type HintLevel = 0 | 1 | 2 | 3

export function findShortestPath(dataset: DemoDataset, startId: StableId, destinationId: StableId): StableId[] {
  if (startId === destinationId) return [startId]

  const queue: StableId[][] = [[startId]]
  const visited = new Set<StableId>([startId])

  while (queue.length > 0) {
    const path = queue.shift()!
    const currentId = path[path.length - 1]
    for (const { stationId } of getNeighbors(dataset, currentId)) {
      if (visited.has(stationId)) continue
      const nextPath = [...path, stationId]
      if (stationId === destinationId) return nextPath
      visited.add(stationId)
      queue.push(nextPath)
    }
  }

  return []
}

export function getDirectionLabel(dataset: DemoDataset, fromId: StableId, toId: StableId) {
  const from = getStation(dataset, fromId)
  const to = getStation(dataset, toId)
  if (!from || !to) return '方向を確認できません'

  const horizontal = to.x > from.x + 12 ? '右' : to.x < from.x - 12 ? '左' : ''
  const vertical = to.y > from.y + 12 ? '下' : to.y < from.y - 12 ? '上' : ''
  return `${horizontal}${vertical}` || '近く'
}

export function getHintText(
  dataset: DemoDataset,
  currentId: StableId,
  destinationId: StableId,
  level: HintLevel
) {
  if (level === 0) return ''
  const shortestPath = findShortestPath(dataset, currentId, destinationId)
  const nextId = shortestPath[1]
  if (!nextId) return currentId === destinationId ? '目的地に到着しています。' : '進める経路が見つかりません。'

  if (level === 1) return `目的地へ近づくには、地図の${getDirectionLabel(dataset, currentId, nextId)}方向を確認しましょう。`

  const edge = findEdge(dataset, currentId, nextId)
  const line = dataset.lines.find((item) => item.stableId === edge?.lineId)
  if (level === 2) return `${line?.name ?? '接続している路線'}を使う経路があります。`

  return `次は「${getStation(dataset, nextId)?.canonicalName ?? '隣の駅'}」へ進む経路があります。`
}
