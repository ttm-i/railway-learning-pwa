import { db } from './db'

const minimumComfortableBytes = 5 * 1024 * 1024

export interface StorageHealthResult {
  writable: boolean
  checkedAt: string
  usageBytes?: number
  quotaBytes?: number
  remainingBytes?: number
  lowSpace: boolean
}

interface StorageEstimator {
  estimate: () => Promise<{ usage?: number; quota?: number }>
}

interface StorageHealthOptions {
  estimator?: StorageEstimator
  writeProbe?: () => Promise<void>
  checkedAt?: string
}

export async function probeStorageWrite() {
  const token = crypto.randomUUID()
  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: '__storageHealthCheck', value: token })
    const record = await db.settings.get('__storageHealthCheck')
    if (record?.value !== token) throw new Error('Storage verification failed')
    await db.settings.delete('__storageHealthCheck')
  })
}

export async function checkStorageHealth(options: StorageHealthOptions = {}): Promise<StorageHealthResult> {
  const checkedAt = options.checkedAt ?? new Date().toISOString()
  const estimator = options.estimator ?? (typeof navigator !== 'undefined' ? navigator.storage : undefined)
  let usageBytes: number | undefined
  let quotaBytes: number | undefined

  try {
    const estimate = await estimator?.estimate()
    usageBytes = estimate?.usage
    quotaBytes = estimate?.quota
  } catch {
    // 容量情報が取得できなくても、実際の書き込み確認は続行する。
  }

  try {
    await (options.writeProbe ?? probeStorageWrite)()
  } catch {
    return { writable: false, checkedAt, usageBytes, quotaBytes, lowSpace: false }
  }

  const remainingBytes = usageBytes !== undefined && quotaBytes !== undefined
    ? Math.max(0, quotaBytes - usageBytes)
    : undefined
  const lowSpace = remainingBytes !== undefined && quotaBytes !== undefined
    ? remainingBytes < minimumComfortableBytes || remainingBytes / Math.max(quotaBytes, 1) < 0.05
    : false

  return { writable: true, checkedAt, usageBytes, quotaBytes, remainingBytes, lowSpace }
}

export function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}
