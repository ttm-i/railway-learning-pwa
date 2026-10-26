import { describe, expect, it } from 'vitest'
import { demoNetwork } from '../data/demoNetwork'
import { calculateMetrics, getNeighbors, isValidPath, validateDataset } from './graph'

describe('架空鉄道データ', () => {
  it('参照切れや重複IDがない', () => {
    expect(validateDataset(demoNetwork)).toEqual([])
  })

  it('確認済みの隣接駅だけを候補にする', () => {
    const neighbors = getNeighbors(demoNetwork, 'demo:station:midori').map((item) => item.stationId)
    expect(neighbors).toEqual(expect.arrayContaining([
      'demo:station:harukaze', 'demo:station:hikari', 'demo:station:sakura', 'demo:station:komorebi'
    ]))
    expect(neighbors).not.toContain('demo:station:minato')
  })

  it('隣接していない駅への移動を有効経路にしない', () => {
    expect(isValidPath(demoNetwork, ['demo:station:harukaze', 'demo:station:minato'])).toBe(false)
  })

  it('路線を変更したときだけ乗換を数える', () => {
    const metrics = calculateMetrics(demoNetwork, [
      'demo:station:harukaze', 'demo:station:midori', 'demo:station:komorebi', 'demo:station:hoshimi'
    ])
    expect(metrics).toEqual({ transfers: 1, railSegments: 3, revisits: 0, walks: 0 })
  })

  it('同じ駅へ戻った回数を再訪として数える', () => {
    const metrics = calculateMetrics(demoNetwork, [
      'demo:station:harukaze', 'demo:station:midori', 'demo:station:harukaze'
    ])
    expect(metrics.revisits).toBe(1)
  })
})
