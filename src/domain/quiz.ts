import type { StableId } from './types'

export type QuizFormat = 'choice' | 'map'

export interface QuizQuestion {
  id: string
  prompt: string
  answerId: StableId
  focusId: StableId
}

export interface RestorableQuizState {
  questionIds: string[]
  currentIndex: number
  format: QuizFormat
  selectedAnswerId?: StableId
  correctCount: number
  datasetVersion: string
}

export const quizQuestions: QuizQuestion[] = [
  { id: 'q-ao-1', prompt: '春風駅から、あおぞら線で次の駅は？', answerId: 'demo:station:midori', focusId: 'demo:station:harukaze' },
  { id: 'q-ao-2', prompt: 'ひかり台駅から、みなと方面の次の駅は？', answerId: 'demo:station:minato', focusId: 'demo:station:hikari' },
  { id: 'q-yu-1', prompt: 'こもれび駅から、さくら野方面の次の駅は？', answerId: 'demo:station:midori', focusId: 'demo:station:komorebi' }
]

export function canRestoreQuiz(state: RestorableQuizState, datasetVersion: string) {
  const knownQuestionIds = new Set(quizQuestions.map((question) => question.id))
  return state.datasetVersion === datasetVersion
    && state.questionIds.length > 0
    && state.questionIds.every((id) => knownQuestionIds.has(id))
    && state.currentIndex >= 0
    && state.currentIndex < state.questionIds.length
    && (state.format === 'choice' || state.format === 'map')
    && state.correctCount >= 0
    && state.correctCount <= state.currentIndex + (state.selectedAnswerId ? 1 : 0)
}

export function getQuestion(questionId: string) {
  return quizQuestions.find((question) => question.id === questionId)
}
