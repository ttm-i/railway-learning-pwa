import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import type { DemoDataset } from './types'
import { layoutMapLabels } from './mapLabels'

describe('map label layout', () => {
  it('shows priority stations at the full-map zoom', () => {
    const labels = layoutMapLabels(demoNetwork, { minX: 0, minY: 0, width: 400, height: 350, zoom: 1 }, 'demo:station:midori')
    const ids = labels.map((label) => label.stationId)

    expect(ids).toContain('demo:station:midori')
    expect(ids).toContain('demo:station:harukaze')
    expect(ids).toContain('demo:station:minato')
    expect(ids).not.toContain('demo:station:hikari')
    expect(ids).not.toContain('demo:station:komorebi')
  })

  it('shows ordinary stations after zooming in', () => {
    const labels = layoutMapLabels(demoNetwork, { minX: 0, minY: 0, width: 400, height: 350, zoom: 1.3 })

    expect(labels.map((label) => label.stationId)).toEqual(expect.arrayContaining(demoNetwork.stations.map((station) => station.stableId)))
  })

  it('prioritizes every station on a selected line', () => {
    const labels = layoutMapLabels(
      demoNetwork,
      { minX: 0, minY: 0, width: 400, height: 350, zoom: 1 },
      undefined,
      'demo:line:aozora'
    )

    expect(labels.map((label) => label.stationId)).toEqual(expect.arrayContaining(demoNetwork.lines[0].stationIds))
  })

  it('moves nearby labels to different positions', () => {
    const closeStations: DemoDataset = {
      version: 'test', publicationDate: '2026-10-28', fictional: true, notice: 'test',
      operators: [{ stableId: 'demo:operator:test', displayName: 'test' }],
      lines: [{
        stableId: 'demo:line:test', operatorId: 'demo:operator:test', name: 'test', color: '#000',
        stationIds: ['demo:station:a', 'demo:station:b']
      }],
      stations: [
        { stableId: 'demo:station:a', canonicalName: '近接A', x: 200, y: 175 },
        { stableId: 'demo:station:b', canonicalName: '近接B', x: 202, y: 175 }
      ],
      edges: []
    }

    const labels = layoutMapLabels(closeStations, { minX: 0, minY: 0, width: 400, height: 350, zoom: 1 })

    expect(labels).toHaveLength(2)
    expect(labels[0].y).not.toBe(labels[1].y)
  })
})
