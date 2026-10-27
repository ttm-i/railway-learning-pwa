import packageJson from '../../package.json'
import { demoNetwork } from '../data/demoNetwork'
import { db, storageChannel, type ManualMasteryRecord, type QuizAnswerRecord, type QuizSuspensionRecord, type RouteHistoryRecord, type RouteSuspensionRecord, type SettingRecord } from './db'

export const backupSchemaVersion = 1

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

export async function createBackup(exportedAt = new Date().toISOString()): Promise<RailwayLearningBackup> {
  return db.transaction(
    'r',
    [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory],
    async () => {
      const [settings, manualMastery, quizAnswers, quizSuspension, routeSuspension, routeHistory] = await Promise.all([
        db.settings.toArray(),
        db.manualMastery.toArray(),
        db.quizAnswers.toArray(),
        db.quizSuspension.toArray(),
        db.routeSuspension.toArray(),
        db.routeHistory.toArray()
      ])
      const datasetVersions = [...new Set([
        demoNetwork.version,
        ...quizAnswers.map((record) => record.datasetVersion),
        ...quizSuspension.map((record) => record.datasetVersion),
        ...routeSuspension.map((record) => record.datasetVersion),
        ...routeHistory.map((record) => record.datasetVersion)
      ])]
      return {
        schemaVersion: backupSchemaVersion,
        exportedAt,
        appVersion: packageJson.version,
        storageChannel,
        datasetVersions,
        data: { settings, manualMastery, quizAnswers, quizSuspension, routeSuspension, routeHistory }
      }
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
