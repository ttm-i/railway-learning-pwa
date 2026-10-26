import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import { findShortestPath, getDirectionLabel, getHintText, getOrderedViaProgress } from './routeGame'

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

  it('counts ordered via stations only when reached in order', () => {
    expect(getOrderedViaProgress(
      ['demo:station:harukaze', 'demo:station:midori', 'demo:station:hikari', 'demo:station:midori'],
      ['demo:station:hikari', 'demo:station:midori']
    )).toBe(2)
    expect(getOrderedViaProgress(
      ['demo:station:harukaze', 'demo:station:midori', 'demo:station:hikari'],
      ['demo:station:hikari', 'demo:station:komorebi']
    )).toBe(1)
  })
})
