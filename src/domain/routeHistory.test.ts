import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import { getRouteLineIds, matchesRouteQuery } from './routeHistory'

const path = [
  'demo:station:harukaze',
  'demo:station:midori',
  'demo:station:komorebi',
  'demo:station:hoshimi'
] as const

describe('route history helpers', () => {
  it('collects used lines once in travel order', () => {
    expect(getRouteLineIds(demoNetwork, [...path])).toEqual(['demo:line:aozora', 'demo:line:yuhi'])
  })

  it('matches a station name or a line name', () => {
    expect(matchesRouteQuery(demoNetwork, [...path], 'こもれ')).toBe(true)
    expect(matchesRouteQuery(demoNetwork, [...path], 'ゆうひ')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(matchesRouteQuery(demoNetwork, [...path], '存在しない')).toBe(false)
  })
})
