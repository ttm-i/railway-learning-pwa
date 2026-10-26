import { useSyncExternalStore } from 'react'

export interface PwaStatusSnapshot {
  online: boolean
  offlineReady: boolean
  updateAvailable: boolean
  registrationError: boolean
}

export function createPwaStatusStore(initial: PwaStatusSnapshot) {
  let snapshot = initial
  let updateHandler: (() => void | Promise<void>) | undefined
  const listeners = new Set<() => void>()

  const update = (changes: Partial<PwaStatusSnapshot>) => {
    const next = { ...snapshot, ...changes }
    if (Object.keys(changes).every((key) => snapshot[key as keyof PwaStatusSnapshot] === next[key as keyof PwaStatusSnapshot])) return
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setOnline: (online: boolean) => update({ online }),
    markOfflineReady: () => update({ offlineReady: true, registrationError: false }),
    markUpdateAvailable: () => update({ updateAvailable: true }),
    markRegistrationError: () => update({ registrationError: true }),
    setUpdateHandler: (handler: () => void | Promise<void>) => { updateHandler = handler },
    applyUpdate: async () => {
      if (!updateHandler) return
      await updateHandler()
      update({ updateAvailable: false })
    }
  }
}

const initialOnline = typeof navigator === 'undefined' ? true : navigator.onLine

export const pwaStatusStore = createPwaStatusStore({
  online: initialOnline,
  offlineReady: false,
  updateAvailable: false,
  registrationError: false
})

export function startNetworkStatusTracking() {
  if (typeof window === 'undefined') return () => undefined
  const updateOnline = () => pwaStatusStore.setOnline(true)
  const updateOffline = () => pwaStatusStore.setOnline(false)
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOffline)
  return () => {
    window.removeEventListener('online', updateOnline)
    window.removeEventListener('offline', updateOffline)
  }
}

export function usePwaStatus() {
  return useSyncExternalStore(pwaStatusStore.subscribe, pwaStatusStore.getSnapshot, pwaStatusStore.getSnapshot)
}
