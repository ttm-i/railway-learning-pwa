import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BackupValidationError, countRecordsSinceBackup, createBackup, createBackupFile, createBackupMetadata, getBackupMetadata, getRecoverySnapshot, mergeWithBackup, parseBackup, parseBackupPreview, recoverySnapshotSettingKey, replaceWithBackup, restoreRecoverySnapshot, shouldShowBackupReminder } from './backup'
import { createDeletedRecordTombstone, db } from './db'

const tables = [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory, db.deletedRecords]

describe('backup export', () => {
  beforeEach(async () => Promise.all(tables.map((table) => table.clear())))
  afterEach(async () => Promise.all(tables.map((table) => table.clear())))

  it('exports versioned data without changing the stored records', async () => {
    await db.settings.put({ key: 'routeSearchFavorites', value: [{ name: '帰り道' }] })
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })

    const backup = await createBackup('2026-10-27T12:34:56.000Z')
    const file = createBackupFile(backup)

    expect(backup).toMatchObject({
      schemaVersion: 2,
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

  it('reminds only after both 30 days and 10 new records', () => {
    const metadata = {
      lastExportAttemptAt: '2026-09-01T00:00:00.000Z',
      fileName: 'backup.json',
      counts: { learnedStations: 0, quizAnswers: 0, routeHistory: 0 }
    }

    expect(shouldShowBackupReminder(metadata, 10, new Date('2026-10-01T00:00:00.000Z'))).toBe(true)
    expect(shouldShowBackupReminder(metadata, 9, new Date('2026-10-01T00:00:00.000Z'))).toBe(false)
    expect(shouldShowBackupReminder(metadata, 10, new Date('2026-09-30T23:59:59.999Z'))).toBe(false)
    expect(shouldShowBackupReminder(null, 99, new Date('2026-10-01T00:00:00.000Z'))).toBe(false)
  })

  it('replaces records atomically while keeping a recovery snapshot', async () => {
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-01T00:00:00.000Z' })
    const incoming = await createBackup('2026-10-01T01:00:00.000Z')

    await db.manualMastery.clear()
    await db.manualMastery.put({ stationId: 'demo:station:minato', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })
    await replaceWithBackup(incoming, 'incoming.json', '2026-10-27T01:00:00.000Z')

    expect(await db.manualMastery.toArray()).toMatchObject([{ stationId: 'demo:station:sakura' }])
    const snapshot = getRecoverySnapshot((await db.settings.get(recoverySnapshotSettingKey))?.value)
    expect(snapshot).toMatchObject({ sourceFileName: 'incoming.json' })
    expect(snapshot?.backup.data.manualMastery).toMatchObject([{ stationId: 'demo:station:minato' }])

    const exported = await createBackup('2026-10-27T02:00:00.000Z')
    expect(exported.data.settings.some((record) => record.key === recoverySnapshotSettingKey)).toBe(false)
  })

  it('can return to the records held before replacement', async () => {
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-01T00:00:00.000Z' })
    const incoming = await createBackup('2026-10-01T01:00:00.000Z')
    await db.manualMastery.clear()
    await db.manualMastery.put({ stationId: 'demo:station:minato', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })

    await replaceWithBackup(incoming, 'incoming.json')
    const snapshot = getRecoverySnapshot((await db.settings.get(recoverySnapshotSettingKey))?.value)
    expect(snapshot).not.toBeNull()
    await restoreRecoverySnapshot(snapshot!)

    expect(await db.manualMastery.toArray()).toMatchObject([{ stationId: 'demo:station:minato' }])
    expect(await db.settings.get(recoverySnapshotSettingKey)).toBeUndefined()
  })

  it('rejects a backup from another release channel without changing records', async () => {
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })
    const backup = await createBackup('2026-10-27T01:00:00.000Z')

    await expect(replaceWithBackup({ ...backup, storageChannel: 'another-channel' }, 'other.json'))
      .rejects.toThrow('別の公開版で作られたため')
    expect(await db.manualMastery.toArray()).toMatchObject([{ stationId: 'demo:station:sakura' }])
    expect(await db.settings.get(recoverySnapshotSettingKey)).toBeUndefined()
  })

  it('merges new records while respecting newer mastery, conflicts, and deletions', async () => {
    await db.settings.put({ key: 'routeSearchFavorites', value: [{
      id: 'favorite-old', name: '古いお気に入り', createdAt: '2026-10-20T00:00:00.000Z',
      startId: 'demo:station:sakura', destinationId: 'demo:station:minato', viaIds: [], excludedLineIds: []
    }] })
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-20T00:00:00.000Z' })
    await db.quizAnswers.bulkPut([
      { id: 'answer-conflict', questionId: 'old-question', answeredAt: '2026-10-20T00:00:00.000Z', answer: 'demo:station:sakura', correct: true, datasetVersion: 'demo-2026-10-26-v1' },
      { id: 'answer-new', questionId: 'new-question', answeredAt: '2026-10-20T01:00:00.000Z', answer: 'demo:station:minato', correct: true, datasetVersion: 'demo-2026-10-26-v1' }
    ])
    await db.routeHistory.put({
      id: 'route-deleted', createdAt: '2026-10-20T00:00:00.000Z', datasetVersion: 'demo-2026-10-26-v1',
      path: ['demo:station:sakura', 'demo:station:midori'], metrics: { railSegments: 1, transfers: 0, revisits: 0, walks: 0 }
    })
    const incoming = await createBackup('2026-10-20T02:00:00.000Z')

    await Promise.all(tables.map((table) => table.clear()))
    await db.settings.put({ key: 'deviceSetting', value: 'keep-current' })
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: false, updatedAt: '2026-10-27T00:00:00.000Z' })
    await db.quizAnswers.put({ id: 'answer-conflict', questionId: 'current-question', answeredAt: '2026-10-27T00:00:00.000Z', answer: 'demo:station:minato', correct: false, datasetVersion: 'demo-2026-10-26-v1' })
    await db.deletedRecords.bulkPut([
      createDeletedRecordTombstone('routeHistory', 'route-deleted', '2026-10-27T00:00:00.000Z'),
      createDeletedRecordTombstone('routeSearchFavorite', 'favorite-old', '2026-10-27T00:00:00.000Z')
    ])

    const result = await mergeWithBackup(incoming, 'new-format.json', '2026-10-27T01:00:00.000Z')

    expect(result).toEqual({ addedRecords: 1, updatedMastery: 0, ignoredConflicts: 1, preventedDeletedRecords: 2 })
    expect(await db.manualMastery.get('demo:station:sakura')).toMatchObject({ learned: false })
    expect(await db.quizAnswers.get('answer-conflict')).toMatchObject({ questionId: 'current-question' })
    expect(await db.quizAnswers.get('answer-new')).toBeDefined()
    expect(await db.routeHistory.get('route-deleted')).toBeUndefined()
    expect((await db.settings.get('routeSearchFavorites'))?.value).toEqual([])
    expect(await db.settings.get('deviceSetting')).toMatchObject({ value: 'keep-current' })
    expect(getRecoverySnapshot((await db.settings.get(recoverySnapshotSettingKey))?.value)).not.toBeNull()

    const secondResult = await mergeWithBackup(incoming, 'new-format.json', '2026-10-27T02:00:00.000Z')
    expect(secondResult.addedRecords).toBe(0)
    expect(await db.quizAnswers.count()).toBe(2)
  })

  it('keeps legacy backups replacement-only', async () => {
    const current = await createBackup('2026-10-27T01:00:00.000Z')
    const { deletedRecords: _deletedRecords, ...legacyData } = current.data
    const legacy = parseBackup(JSON.stringify({ ...current, schemaVersion: 1, data: legacyData }))

    await expect(mergeWithBackup(legacy, 'legacy.json')).rejects.toThrow('置き換え')
    await expect(replaceWithBackup(legacy, 'legacy.json')).resolves.toBeUndefined()
  })
})
