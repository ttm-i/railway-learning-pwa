import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup, createBackupFile } from './backup'
import { db } from './db'

const tables = [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory]

describe('backup export', () => {
  beforeEach(async () => Promise.all(tables.map((table) => table.clear())))
  afterEach(async () => Promise.all(tables.map((table) => table.clear())))

  it('exports versioned data without changing the stored records', async () => {
    await db.settings.put({ key: 'routeSearchFavorites', value: [{ name: '帰り道' }] })
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })

    const backup = await createBackup('2026-10-27T12:34:56.000Z')
    const file = createBackupFile(backup)

    expect(backup).toMatchObject({
      schemaVersion: 1,
      exportedAt: '2026-10-27T12:34:56.000Z',
      appVersion: '0.1.0',
      datasetVersions: ['demo-2026-10-26-v1']
    })
    expect(backup.data.settings).toHaveLength(1)
    expect(backup.data.manualMastery).toHaveLength(1)
    expect(file.name).toBe('railway-learning-backup-2026-10-27_12-34-56.json')
    expect(file.type).toBe('application/json')
    expect(await db.manualMastery.count()).toBe(1)
  })
})
