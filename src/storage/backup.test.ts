import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BackupValidationError, countRecordsSinceBackup, createBackup, createBackupFile, createBackupMetadata, getBackupMetadata, parseBackupPreview } from './backup'
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

  it('validates a backup and returns a read-only summary', async () => {
    await db.settings.put({ key: 'routeSearchFavorites', value: [{ id: 'favorite-1' }, { id: 'favorite-2' }] })
    await db.quizAnswers.put({
      id: 'answer-1', questionId: 'question-1', answeredAt: '2026-10-27T00:00:00.000Z',
      answer: 'demo:station:sakura', correct: true, datasetVersion: 'demo-2026-10-26-v1'
    })
    const backup = await createBackup('2026-10-27T12:34:56.000Z')

    expect(parseBackupPreview(JSON.stringify(backup))).toMatchObject({
      exportedAt: '2026-10-27T12:34:56.000Z',
      counts: { quizAnswers: 1, favorites: 2, routeHistory: 0 }
    })
    expect(await db.quizAnswers.count()).toBe(1)
  })

  it('rejects malformed and unsupported backup files', () => {
    expect(() => parseBackupPreview('{broken')).toThrow(BackupValidationError)
    expect(() => parseBackupPreview(JSON.stringify({ schemaVersion: 99 }))).toThrow('対応していないバックアップ形式です。')
  })

  it('records an export attempt and counts only later increases', async () => {
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })
    const backup = await createBackup('2026-10-27T12:34:56.000Z')
    const metadata = createBackupMetadata(backup, 'backup.json', '2026-10-27T12:35:00.000Z')

    expect(getBackupMetadata(metadata)).toEqual(metadata)
    expect(countRecordsSinceBackup(metadata, { learnedStations: 2, quizAnswers: 3, routeHistory: 1 })).toBe(5)
    expect(countRecordsSinceBackup(metadata, { learnedStations: 0, quizAnswers: 0, routeHistory: 0 })).toBe(0)
    expect(getBackupMetadata({ lastExportAttemptAt: 'invalid' })).toBeNull()
  })
})
