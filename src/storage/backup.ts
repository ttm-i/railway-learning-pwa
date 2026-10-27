import packageJson from '../../package.json'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel, type ManualMasteryRecord, type QuizAnswerRecord, type QuizSuspensionRecord, type RouteHistoryRecord, type RouteSuspensionRecord, type SettingRecord } from './db'

export const backupSchemaVersion = 1
export const maximumBackupFileBytes = 20 * 1024 * 1024
export const backupReminderAfterDays = 30
export const backupReminderAfterRecords = 10
export const recoverySnapshotSettingKey = 'beforeImportSnapshot'
const restoreMetadataSettingKey = 'restoreMetadata'

export interface RailwayLearningBackup {
  schemaVersion: number
  exportedAt: string
  appVersion: string
  storageChannel: string
  datasetVersions: string[]
  data: {
    settings: SettingRecord[]
    manualMastery: ManualMasteryRecord[]
    quizAnswers: QuizAnswerRecord[]
    quizSuspension: QuizSuspensionRecord[]
    routeSuspension: RouteSuspensionRecord[]
    routeHistory: RouteHistoryRecord[]
  }
}

export interface BackupPreview {
  exportedAt: string
  appVersion: string
  storageChannel: string
  datasetVersions: string[]
  counts: {
    learnedStations: number
    quizAnswers: number
    routeHistory: number
    favorites: number
    suspendedActivities: number
  }
}

export interface BackupRecordCounts {
  learnedStations: number
  quizAnswers: number
  routeHistory: number
}

export interface BackupMetadata {
  lastExportAttemptAt: string
  fileName: string
  counts: BackupRecordCounts
}

export interface RecoverySnapshot {
  createdAt: string
  sourceFileName: string
  backup: RailwayLearningBackup
}

export class BackupValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isArrayOf(value: unknown, validate: (item: Record<string, unknown>) => boolean) {
  return Array.isArray(value) && value.every((item) => isRecord(item) && validate(item))
}

function isInternalRestoreSetting(record: SettingRecord) {
  return record.key === recoverySnapshotSettingKey || record.key === restoreMetadataSettingKey
}

export function createBackupMetadata(backup: RailwayLearningBackup, fileName: string, attemptedAt = new Date().toISOString()): BackupMetadata {
  return {
    lastExportAttemptAt: attemptedAt,
    fileName,
    counts: {
      learnedStations: backup.data.manualMastery.filter((record) => record.learned).length,
      quizAnswers: backup.data.quizAnswers.length,
      routeHistory: backup.data.routeHistory.length
    }
  }
}

export function getBackupMetadata(value: unknown): BackupMetadata | null {
  if (!isRecord(value) || typeof value.lastExportAttemptAt !== 'string' || Number.isNaN(Date.parse(value.lastExportAttemptAt)) || typeof value.fileName !== 'string' || !isRecord(value.counts)) return null
  const { learnedStations, quizAnswers, routeHistory } = value.counts
  if (![learnedStations, quizAnswers, routeHistory].every((count) => typeof count === 'number' && Number.isInteger(count) && count >= 0)) return null
  return value as unknown as BackupMetadata
}

export function countRecordsSinceBackup(metadata: BackupMetadata, current: BackupRecordCounts) {
  return (
    Math.max(0, current.learnedStations - metadata.counts.learnedStations)
    + Math.max(0, current.quizAnswers - metadata.counts.quizAnswers)
    + Math.max(0, current.routeHistory - metadata.counts.routeHistory)
  )
}

export function shouldShowBackupReminder(
  metadata: BackupMetadata | null,
  recordsSinceBackup: number,
  now = new Date()
) {
  if (!metadata || recordsSinceBackup < backupReminderAfterRecords) return false
  const elapsedMilliseconds = now.getTime() - Date.parse(metadata.lastExportAttemptAt)
  return elapsedMilliseconds >= backupReminderAfterDays * 24 * 60 * 60 * 1000
}

function validateBackupValue(value: unknown): RailwayLearningBackup {
  if (!isRecord(value)) throw new BackupValidationError('バックアップの基本形式が正しくありません。')
  if (value.schemaVersion !== backupSchemaVersion) throw new BackupValidationError('対応していないバックアップ形式です。')
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) throw new BackupValidationError('書き出し日時を確認できません。')
  if (typeof value.appVersion !== 'string' || typeof value.storageChannel !== 'string') throw new BackupValidationError('アプリ情報を確認できません。')
  if (!Array.isArray(value.datasetVersions) || !value.datasetVersions.every((item) => typeof item === 'string')) throw new BackupValidationError('鉄道データ版を確認できません。')
  if (!isRecord(value.data)) throw new BackupValidationError('記録データが見つかりません。')

  const data = value.data
  const valid = (
    isArrayOf(data.settings, (item) => typeof item.key === 'string')
    && isArrayOf(data.manualMastery, (item) => typeof item.stationId === 'string' && typeof item.learned === 'boolean' && typeof item.updatedAt === 'string')
    && isArrayOf(data.quizAnswers, (item) => typeof item.id === 'string' && typeof item.datasetVersion === 'string')
    && isArrayOf(data.quizSuspension, (item) => item.id === 'active' && typeof item.datasetVersion === 'string')
    && isArrayOf(data.routeSuspension, (item) => item.id === 'active' && typeof item.datasetVersion === 'string')
    && isArrayOf(data.routeHistory, (item) => typeof item.id === 'string' && typeof item.datasetVersion === 'string')
  )
  if (!valid) throw new BackupValidationError('必要な記録の一部が不足しているか、形式が正しくありません。')

  const settings = data.settings as unknown as SettingRecord[]
  const manualMastery = data.manualMastery as unknown as ManualMasteryRecord[]
  const quizAnswers = data.quizAnswers as unknown as QuizAnswerRecord[]
  const quizSuspension = data.quizSuspension as unknown as QuizSuspensionRecord[]
  const routeSuspension = data.routeSuspension as unknown as RouteSuspensionRecord[]
  const routeHistory = data.routeHistory as unknown as RouteHistoryRecord[]
  return {
    schemaVersion: value.schemaVersion,
    exportedAt: value.exportedAt,
    appVersion: value.appVersion,
    storageChannel: value.storageChannel,
    datasetVersions: value.datasetVersions,
    data: { settings, manualMastery, quizAnswers, quizSuspension, routeSuspension, routeHistory }
  }
}

export function parseBackup(text: string): RailwayLearningBackup {
  try {
    return validateBackupValue(JSON.parse(text))
  } catch (error) {
    if (error instanceof BackupValidationError) throw error
    throw new BackupValidationError('JSONファイルとして読み取れませんでした。')
  }
}

export function createBackupPreview(backup: RailwayLearningBackup): BackupPreview {
  const favoritesValue = backup.data.settings.find((record) => record.key === 'routeSearchFavorites')?.value

  return {
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    storageChannel: backup.storageChannel,
    datasetVersions: backup.datasetVersions,
    counts: {
      learnedStations: backup.data.manualMastery.filter((record) => record.learned).length,
      quizAnswers: backup.data.quizAnswers.length,
      routeHistory: backup.data.routeHistory.length,
      favorites: Array.isArray(favoritesValue) ? favoritesValue.length : 0,
      suspendedActivities: backup.data.quizSuspension.length + backup.data.routeSuspension.length
    }
  }
}

export function parseBackupPreview(text: string): BackupPreview {
  return createBackupPreview(parseBackup(text))
}

export function getBackupRestoreBlockReason(backup: RailwayLearningBackup) {
  if (backup.storageChannel !== storageChannel) return 'このバックアップは別の公開版で作られたため、現在のアプリには復元できません。'
  if (!backup.datasetVersions.includes(demoNetwork.version)) return '現在の鉄道データ版に対応していないため、このバックアップは復元できません。'
  return null
}

function createBackupFromData(data: RailwayLearningBackup['data'], exportedAt: string): RailwayLearningBackup {
  const datasetVersions = [...new Set([
    demoNetwork.version,
    ...data.quizAnswers.map((record) => record.datasetVersion),
    ...data.quizSuspension.map((record) => record.datasetVersion),
    ...data.routeSuspension.map((record) => record.datasetVersion),
    ...data.routeHistory.map((record) => record.datasetVersion)
  ])]
  return {
    schemaVersion: backupSchemaVersion,
    exportedAt,
    appVersion: packageJson.version,
    storageChannel,
    datasetVersions,
    data: { ...data, settings: data.settings.filter((record) => !isInternalRestoreSetting(record)) }
  }
}

async function readCurrentData(): Promise<RailwayLearningBackup['data']> {
  const [settings, manualMastery, quizAnswers, quizSuspension, routeSuspension, routeHistory] = await Promise.all([
    db.settings.toArray(),
    db.manualMastery.toArray(),
    db.quizAnswers.toArray(),
    db.quizSuspension.toArray(),
    db.routeSuspension.toArray(),
    db.routeHistory.toArray()
  ])
  return { settings, manualMastery, quizAnswers, quizSuspension, routeSuspension, routeHistory }
}

async function replaceStoredData(data: RailwayLearningBackup['data']) {
  await Promise.all([
    db.settings.clear(),
    db.manualMastery.clear(),
    db.quizAnswers.clear(),
    db.quizSuspension.clear(),
    db.routeSuspension.clear(),
    db.routeHistory.clear()
  ])
  const settings = data.settings.filter((record) => !isInternalRestoreSetting(record))
  await Promise.all([
    settings.length ? db.settings.bulkPut(settings) : Promise.resolve(),
    data.manualMastery.length ? db.manualMastery.bulkPut(data.manualMastery) : Promise.resolve(),
    data.quizAnswers.length ? db.quizAnswers.bulkPut(data.quizAnswers) : Promise.resolve(),
    data.quizSuspension.length ? db.quizSuspension.bulkPut(data.quizSuspension) : Promise.resolve(),
    data.routeSuspension.length ? db.routeSuspension.bulkPut(data.routeSuspension) : Promise.resolve(),
    data.routeHistory.length ? db.routeHistory.bulkPut(data.routeHistory) : Promise.resolve()
  ])
}

export async function replaceWithBackup(
  backup: RailwayLearningBackup,
  sourceFileName: string,
  restoredAt = new Date().toISOString()
) {
  const blockReason = getBackupRestoreBlockReason(backup)
  if (blockReason) throw new BackupValidationError(blockReason)
  await db.transaction(
    'rw',
    [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory],
    async () => {
      const currentData = await readCurrentData()
      const snapshot: RecoverySnapshot = {
        createdAt: restoredAt,
        sourceFileName,
        backup: createBackupFromData(currentData, restoredAt)
      }
      await replaceStoredData(backup.data)
      await db.settings.bulkPut([
        { key: recoverySnapshotSettingKey, value: snapshot },
        { key: restoreMetadataSettingKey, value: { lastRestoreAt: restoredAt, sourceFileName } }
      ])
    }
  )
}

export function getRecoverySnapshot(value: unknown): RecoverySnapshot | null {
  if (!isRecord(value) || typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt)) || typeof value.sourceFileName !== 'string') return null
  try {
    const backup = validateBackupValue(value.backup)
    if (getBackupRestoreBlockReason(backup)) return null
    return { createdAt: value.createdAt, sourceFileName: value.sourceFileName, backup }
  } catch {
    return null
  }
}

export async function restoreRecoverySnapshot(snapshot: RecoverySnapshot) {
  const validated = getRecoverySnapshot(snapshot)
  if (!validated) throw new BackupValidationError('復元前の退避データを確認できませんでした。')
  await db.transaction(
    'rw',
    [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory],
    async () => replaceStoredData(validated.backup.data)
  )
}

export async function createBackup(exportedAt = new Date().toISOString()): Promise<RailwayLearningBackup> {
  return db.transaction(
    'r',
    [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory],
    async () => {
      return createBackupFromData(await readCurrentData(), exportedAt)
    }
  )
}

export function createBackupFile(backup: RailwayLearningBackup) {
  const timestamp = backup.exportedAt.slice(0, 19).replace('T', '_').replaceAll(':', '-')
  return new File(
    [JSON.stringify(backup, null, 2)],
    `railway-learning-backup-${timestamp}.json`,
    { type: 'application/json' }
  )
}

export async function presentBackupFile(file: File): Promise<'share' | 'download'> {
  const shareData: ShareData = {
    title: '首都圏鉄道学習 バックアップ',
    text: '学習記録のバックアップファイルです。',
    files: [file]
  }
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData)
    return 'share'
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'download'
}
