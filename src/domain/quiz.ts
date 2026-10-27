import type { StableId, Station } from './types'

export type QuizFormat = 'choice' | 'map' | 'text'

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
  textDraft?: string
  textAnswerCorrect?: boolean
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
    && (state.format === 'choice' || state.format === 'map' || state.format === 'text')
    && state.correctCount >= 0
    && state.correctCount <= state.currentIndex + (state.selectedAnswerId || state.textAnswerCorrect !== undefined ? 1 : 0)
}

export function normalizeStationAnswer(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, '')
    .replace(/駅$/u, '')
    .replace(/[ァ-ヶ]/gu, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .toLocaleLowerCase('ja')
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0]
    row[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex]
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      )
      previous = current
    }
  }
  return row[right.length]
}

export function evaluateStationText(value: string, station: Station): 'correct' | 'confirm' | 'incorrect' {
  const normalized = normalizeStationAnswer(value)
  if (!normalized) return 'incorrect'
  const acceptedNames = [station.canonicalName, ...(station.aliases ?? [])].map(normalizeStationAnswer)
  if (acceptedNames.includes(normalized)) return 'correct'
  return acceptedNames.some((name) => editDistance(normalized, name) === 1) ? 'confirm' : 'incorrect'
}

export function getQuestion(questionId: string) {
  return quizQuestions.find((question) => question.id === questionId)
}
