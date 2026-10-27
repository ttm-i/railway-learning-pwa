import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkStorageHealth, formatStorageBytes, probeStorageWrite } from './storageHealth'
import { db } from './db'

describe('storage health', () => {
  beforeEach(async () => db.settings.clear())
  afterEach(async () => db.settings.clear())

  it('verifies a temporary write and removes the check record', async () => {
    await db.settings.put({ key: 'existing', value: true })
    await probeStorageWrite()

    expect(await db.settings.get('__storageHealthCheck')).toBeUndefined()
    expect(await db.settings.get('existing')).toMatchObject({ value: true })
  })

  it('reports available estimates and low space without guessing when unavailable', async () => {
    const healthy = await checkStorageHealth({
      checkedAt: '2026-10-27T00:00:00.000Z',
      estimator: { estimate: async () => ({ usage: 10 * 1024 * 1024, quota: 100 * 1024 * 1024 }) },
      writeProbe: vi.fn().mockResolvedValue(undefined)
    })
    expect(healthy).toMatchObject({ writable: true, remainingBytes: 90 * 1024 * 1024, lowSpace: false })

    const low = await checkStorageHealth({
      estimator: { estimate: async () => ({ usage: 98 * 1024 * 1024, quota: 100 * 1024 * 1024 }) },
      writeProbe: vi.fn().mockResolvedValue(undefined)
    })
    expect(low.lowSpace).toBe(true)
    expect(formatStorageBytes(low.remainingBytes!)).toBe('2.0MB')
  })

  it('reports a failed write without deleting user records', async () => {
    await db.settings.put({ key: 'existing', value: true })
    const result = await checkStorageHealth({ writeProbe: vi.fn().mockRejectedValue(new Error('quota')) })

    expect(result.writable).toBe(false)
    expect(await db.settings.get('existing')).toMatchObject({ value: true })
  })
})
