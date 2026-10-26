import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import type { DemoDataset } from './types'
import { findRoute, findRouteCandidates } from './routeSearch'

const alternativeNetwork: DemoDataset = {
  version: 'demo-search-v1', publicationDate: '2026-10-27', fictional: true, notice: 'test',
  operators: [{ stableId: 'demo:operator:test', displayName: 'test' }],
  stations: [
    { stableId: 'demo:station:a', canonicalName: 'A', x: 0, y: 0 },
    { stableId: 'demo:station:b', canonicalName: 'B', x: 1, y: 0 },
    { stableId: 'demo:station:c', canonicalName: 'C', x: 0, y: 1 },
    { stableId: 'demo:station:e', canonicalName: 'E', x: 1, y: 1 },
    { stableId: 'demo:station:d', canonicalName: 'D', x: 2, y: 0 }
  ],
  lines: [
    { stableId: 'demo:line:one', operatorId: 'demo:operator:test', name: '1', color: '#111', stationIds: ['demo:station:a', 'demo:station:b'] },
    { stableId: 'demo:line:two', operatorId: 'demo:operator:test', name: '2', color: '#222', stationIds: ['demo:station:b', 'demo:station:d'] },
    { stableId: 'demo:line:three', operatorId: 'demo:operator:test', name: '3', color: '#333', stationIds: ['demo:station:a', 'demo:station:c', 'demo:station:e', 'demo:station:d'] }
  ],
  edges: [
    { stableId: 'demo:edge:ab', from: 'demo:station:a', to: 'demo:station:b', kind: 'rail', lineId: 'demo:line:one', confirmationStatus: 'confirmed' },
    { stableId: 'demo:edge:bd', from: 'demo:station:b', to: 'demo:station:d', kind: 'rail', lineId: 'demo:line:two', confirmationStatus: 'confirmed' },
    { stableId: 'demo:edge:ac', from: 'demo:station:a', to: 'demo:station:c', kind: 'rail', lineId: 'demo:line:three', confirmationStatus: 'confirmed' },
    { stableId: 'demo:edge:ce', from: 'demo:station:c', to: 'demo:station:e', kind: 'rail', lineId: 'demo:line:three', confirmationStatus: 'confirmed' },
    { stableId: 'demo:edge:ed', from: 'demo:station:e', to: 'demo:station:d', kind: 'rail', lineId: 'demo:line:three', confirmationStatus: 'confirmed' }
  ]
}

describe('route search', () => {
  it('separates fewer segments from fewer transfers', () => {
    expect(findRoute(alternativeNetwork, 'demo:station:a', 'demo:station:d', [], 'segments')).toEqual([
      'demo:station:a', 'demo:station:b', 'demo:station:d'
    ])
    expect(findRoute(alternativeNetwork, 'demo:station:a', 'demo:station:d', [], 'transfers')).toEqual([
      'demo:station:a', 'demo:station:c', 'demo:station:e', 'demo:station:d'
    ])
  })

  it('honors ordered via stations even when returning through a hub', () => {
    expect(findRoute(
      demoNetwork,
      'demo:station:harukaze',
      'demo:station:hoshimi',
      ['demo:station:hikari'],
      'segments'
    )).toEqual([
      'demo:station:harukaze', 'demo:station:midori', 'demo:station:hikari',
      'demo:station:midori', 'demo:station:komorebi', 'demo:station:hoshimi'
    ])
  })

  it('merges identical candidates instead of claiming two results', () => {
    const candidates = findRouteCandidates(demoNetwork, 'demo:station:harukaze', 'demo:station:hoshimi')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].kind).toBe('both')
  })
})
