import Dexie, { type EntityTable } from 'dexie'
import type { RouteMetrics, StableId } from '../domain/types'

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
  answer: StableId
  correct: boolean
  datasetVersion: string
}

export interface RouteSuspensionRecord {
  id: 'active'
  startId: StableId
  destinationId: StableId
  path: StableId[]
  datasetVersion: string
  updatedAt: string
}

export interface RouteHistoryRecord {
  id: string
  createdAt: string
  datasetVersion: string
  path: StableId[]
  metrics: RouteMetrics
}

const channel = import.meta.env.VITE_APP_CHANNEL || 'development'

class RailwayLearningDatabase extends Dexie {
  settings!: EntityTable<SettingRecord, 'key'>
  manualMastery!: EntityTable<ManualMasteryRecord, 'stationId'>
  quizAnswers!: EntityTable<QuizAnswerRecord, 'id'>
  routeSuspension!: EntityTable<RouteSuspensionRecord, 'id'>
  routeHistory!: EntityTable<RouteHistoryRecord, 'id'>

  constructor() {
    super(`railway-learning-${channel}`)
    this.version(1).stores({
      settings: 'key',
      manualMastery: 'stationId, learned, updatedAt',
      quizAnswers: 'id, answeredAt, correct, datasetVersion',
      routeSuspension: 'id, updatedAt, datasetVersion',
      routeHistory: 'id, createdAt, datasetVersion'
    })
  }
}

export const db = new RailwayLearningDatabase()
export const storageChannel = channel
