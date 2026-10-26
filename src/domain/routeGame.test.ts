import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import { findShortestPath, getDirectionLabel, getHintText } from './routeGame'

describe('route game helpers', () => {
  it('finds a shortest confirmed path', () => {
    expect(findShortestPath(demoNetwork, 'demo:station:harukaze', 'demo:station:hoshimi')).toEqual([
      'demo:station:harukaze',
      'demo:station:midori',
      'demo:station:komorebi',
      'demo:station:hoshimi'
    ])
  })

  it('describes the direction without revealing a station name', () => {
    expect(getDirectionLabel(demoNetwork, 'demo:station:harukaze', 'demo:station:midori')).toBe('右上')
    expect(getHintText(demoNetwork, 'demo:station:harukaze', 'demo:station:hoshimi', 1)).not.toContain('みどり中央')
  })

  it('reveals the line and then the next station in stages', () => {
    expect(getHintText(demoNetwork, 'demo:station:harukaze', 'demo:station:hoshimi', 2)).toContain('あおぞら線')
    expect(getHintText(demoNetwork, 'demo:station:harukaze', 'demo:station:hoshimi', 3)).toContain('みどり中央')
  })
})
