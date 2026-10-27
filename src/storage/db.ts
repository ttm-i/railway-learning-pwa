import Dexie, { type EntityTable } from 'dexie'
import type { RouteMetrics, StableId } from '../domain/types'
import type { QuizFormat } from '../domain/quiz'
import type { HintLevel, RouteLabelMode } from '../domain/routeGame'

export interface SettingRecord {
  key: string
  value: unknown
}

export interface ManualMasteryRecord {
  stationId: StableId
  learned: boolean
  updatedAt: string
}

export interface QuizAnswerRecord {
  id: string
  questionId: string
  answeredAt: string
  answer?: StableId
  textAnswer?: string
  correct: boolean
  datasetVersion: string
}

export interface QuizSuspensionRecord {
  id: 'active'
  questionIds: string[]
  currentIndex: number
  format: QuizFormat
  selectedAnswerId?: StableId
  textDraft?: string
  textAnswerCorrect?: boolean
  correctCount: number
  datasetVersion: string
  updatedAt: string
}

export interface RouteSuspensionRecord {
  id: 'active'
  startId: StableId
  destinationId: StableId
  path: StableId[]
  labelMode?: RouteLabelMode
  hintLevel?: HintLevel
  routeExpanded?: boolean
  viaIds?: StableId[]
  excludedLineIds?: StableId[]
  datasetVersion: string
  updatedAt: string
}

export interface RouteHistoryRecord {
  id: string
  createdAt: string
  datasetVersion: string
  path: StableId[]
  lineIds?: StableId[]
  viaIds?: StableId[]
  excludedLineIds?: StableId[]
  metrics: RouteMetrics
}

export type DeletedRecordType = 'routeHistory' | 'routeSearchFavorite'

export interface DeletedRecordTombstone {
  id: string
  recordType: DeletedRecordType
  recordId: string
  deletedAt: string
}

export function createDeletedRecordTombstone(recordType: DeletedRecordType, recordId: string, deletedAt = new Date().toISOString()): DeletedRecordTombstone {
  return { id: `${recordType}:${recordId}`, recordType, recordId, deletedAt }
}

const channel = import.meta.env.VITE_APP_CHANNEL || 'development'

class RailwayLearningDatabase extends Dexie {
  settings!: EntityTable<SettingRecord, 'key'>
  manualMastery!: EntityTable<ManualMasteryRecord, 'stationId'>
  quizAnswers!: EntityTable<QuizAnswerRecord, 'id'>
  quizSuspension!: EntityTable<QuizSuspensionRecord, 'id'>
  routeSuspension!: EntityTable<RouteSuspensionRecord, 'id'>
  routeHistory!: EntityTable<RouteHistoryRecord, 'id'>
  deletedRecords!: EntityTable<DeletedRecordTombstone, 'id'>

  constructor() {
    super(`railway-learning-${channel}`)
    this.version(1).stores({
      settings: 'key',
      manualMastery: 'stationId, learned, updatedAt',
      quizAnswers: 'id, answeredAt, correct, datasetVersion',
      routeSuspension: 'id, updatedAt, datasetVersion',
      routeHistory: 'id, createdAt, datasetVersion'
    })
    this.version(2).stores({
      settings: 'key',
      manualMastery: 'stationId, learned, updatedAt',
      quizAnswers: 'id, answeredAt, correct, datasetVersion',
      quizSuspension: 'id, updatedAt, datasetVersion',
      routeSuspension: 'id, updatedAt, datasetVersion',
      routeHistory: 'id, createdAt, datasetVersion'
    })
    this.version(3).stores({
      settings: 'key',
      manualMastery: 'stationId, learned, updatedAt',
      quizAnswers: 'id, answeredAt, correct, datasetVersion',
      quizSuspension: 'id, updatedAt, datasetVersion',
      routeSuspension: 'id, updatedAt, datasetVersion',
      routeHistory: 'id, createdAt, datasetVersion',
      deletedRecords: 'id, recordType, recordId, deletedAt'
    })
  }
}

export const db = new RailwayLearningDatabase()
export const storageChannel = channel
