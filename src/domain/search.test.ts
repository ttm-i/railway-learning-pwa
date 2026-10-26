import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import { searchNetwork } from './search'

describe('駅・路線検索', () => {
  it('駅名の一部から駅を探せる', () => {
    expect(searchNetwork(demoNetwork, '中央').stations.map((station) => station.canonicalName)).toEqual(['みどり中央'])
  })

  it('空白と文字幅の違いを無視する', () => {
    expect(searchNetwork(demoNetwork, ' みどり　中央 ').stations).toHaveLength(1)
  })

  it('路線名の一部から路線を探せる', () => {
    expect(searchNetwork(demoNetwork, 'あおぞら').lines.map((line) => line.name)).toEqual(['あおぞら線'])
  })

  it('空欄では候補を返さない', () => {
    expect(searchNetwork(demoNetwork, '  ')).toEqual({ stations: [], lines: [] })
  })
})
