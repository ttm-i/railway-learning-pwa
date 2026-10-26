import { describe, expect, it, vi } from 'vitest'
import { createPwaStatusStore } from './pwaStatus'

describe('PWA status store', () => {
  it('reports offline readiness, connectivity, and updates', async () => {
    const store = createPwaStatusStore({ online: true, offlineReady: false, updateAvailable: false, registrationError: false })
    const listener = vi.fn()
    store.subscribe(listener)

    store.markOfflineReady()
    store.setOnline(false)
    store.markUpdateAvailable()

    expect(store.getSnapshot()).toEqual({ online: false, offlineReady: true, updateAvailable: true, registrationError: false })
    expect(listener).toHaveBeenCalledTimes(3)

    const update = vi.fn()
    store.setUpdateHandler(update)
    await store.applyUpdate()
    expect(update).toHaveBeenCalledOnce()
    expect(store.getSnapshot().updateAvailable).toBe(false)
  })
})
