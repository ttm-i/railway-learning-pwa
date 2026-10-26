import { calculateMetrics, getNeighbors } from './graph'
import type { DemoDataset, RouteMetrics, StableId } from './types'

export type RouteSearchPriority = 'segments' | 'transfers'

export interface RouteCandidate {
  kind: RouteSearchPriority | 'both'
  path: StableId[]
  metrics: RouteMetrics
}

interface SearchState {
  stationId: StableId
  lineId?: StableId
  viaIndex: number
  path: StableId[]
  segments: number
  transfers: number
}

function advanceVia(viaIds: StableId[], viaIndex: number, stationId: StableId) {
  return viaIds[viaIndex] === stationId ? viaIndex + 1 : viaIndex
}

function compareStates(a: SearchState, b: SearchState, priority: RouteSearchPriority) {
  const aValues = priority === 'segments'
    ? [a.segments, a.transfers]
    : [a.transfers, a.segments]
  const bValues = priority === 'segments'
    ? [b.segments, b.transfers]
    : [b.transfers, b.segments]
  const primary = aValues[0] - bValues[0]
  if (primary !== 0) return primary
  const secondary = aValues[1] - bValues[1]
  if (secondary !== 0) return secondary
  return a.path.join('|').localeCompare(b.path.join('|'))
}

function stateKey(state: SearchState) {
  return `${state.stationId}|${state.lineId ?? 'start'}|${state.viaIndex}`
}

export function findRoute(
  dataset: DemoDataset,
  startId: StableId,
  destinationId: StableId,
  viaIds: StableId[],
  priority: RouteSearchPriority,
  excludedLineIds: StableId[] = []
) {
  const initial: SearchState = {
    stationId: startId,
    viaIndex: advanceVia(viaIds, 0, startId),
    path: [startId],
    segments: 0,
    transfers: 0
  }
  const queue = [initial]
  const best = new Map<string, SearchState>()

  while (queue.length > 0) {
    queue.sort((a, b) => compareStates(a, b, priority))
    const current = queue.shift()!
    const key = stateKey(current)
    const known = best.get(key)
    if (known && compareStates(known, current, priority) <= 0) continue
    best.set(key, current)

    if (current.stationId === destinationId && current.viaIndex === viaIds.length) return current.path

    getNeighbors(dataset, current.stationId).forEach(({ stationId, edge }) => {
      if (excludedLineIds.includes(edge.lineId)) return
      const next: SearchState = {
        stationId,
        lineId: edge.lineId,
        viaIndex: advanceVia(viaIds, current.viaIndex, stationId),
        path: [...current.path, stationId],
        segments: current.segments + 1,
        transfers: current.transfers + (current.lineId && current.lineId !== edge.lineId ? 1 : 0)
      }
      const nextKnown = best.get(stateKey(next))
      if (!nextKnown || compareStates(next, nextKnown, priority) < 0) queue.push(next)
    })
  }

  return []
}

export function findRouteCandidates(
  dataset: DemoDataset,
  startId: StableId,
  destinationId: StableId,
  viaIds: StableId[] = [],
  excludedLineIds: StableId[] = []
): RouteCandidate[] {
  const segmentsPath = findRoute(dataset, startId, destinationId, viaIds, 'segments', excludedLineIds)
  const transfersPath = findRoute(dataset, startId, destinationId, viaIds, 'transfers', excludedLineIds)
  if (segmentsPath.length === 0 && transfersPath.length === 0) return []
  if (segmentsPath.join('|') === transfersPath.join('|')) {
    return [{ kind: 'both', path: segmentsPath, metrics: calculateMetrics(dataset, segmentsPath) }]
  }
  return [
    { kind: 'segments', path: segmentsPath, metrics: calculateMetrics(dataset, segmentsPath) },
    { kind: 'transfers', path: transfersPath, metrics: calculateMetrics(dataset, transfersPath) }
  ].filter((candidate) => candidate.path.length > 0) as RouteCandidate[]
}
