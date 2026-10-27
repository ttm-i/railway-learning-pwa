import { describe, expect, it } from 'vitest'
import { canRestoreQuiz, evaluateStationText, getQuestion, normalizeStationAnswer, quizQuestions } from './quiz'
import { demoNetwork } from '../data/demoNetwork'

const datasetVersion = 'demo-2026-10-26-v1'

describe('クイズの途中保存', () => {
  it('現在の問題とデータ版が有効なら再開できる', () => {
    expect(canRestoreQuiz({
      questionIds: quizQuestions.map((question) => question.id),
      currentIndex: 1,
      format: 'map',
      correctCount: 1,
      datasetVersion
    }, datasetVersion)).toBe(true)
  })

  it('未知の問題や異なるデータ版は再開しない', () => {
    expect(canRestoreQuiz({ questionIds: ['unknown'], currentIndex: 0, format: 'choice', correctCount: 0, datasetVersion }, datasetVersion)).toBe(false)
    expect(canRestoreQuiz({ questionIds: [quizQuestions[0].id], currentIndex: 0, format: 'choice', correctCount: 0, datasetVersion: 'old' }, datasetVersion)).toBe(false)
  })

  it('問題IDから問題を取得できる', () => {
    expect(getQuestion(quizQuestions[0].id)?.answerId).toBe('demo:station:midori')
  })

  it('駅名の空白・駅の有無・かな表記を受け入れる', () => {
    const station = demoNetwork.stations.find((item) => item.stableId === 'demo:station:midori')!
    expect(normalizeStationAnswer('  ミドリ チュウオウ駅 ')).toBe('みどりちゅうおう')
    expect(evaluateStationText('みどり中央駅', station)).toBe('correct')
    expect(evaluateStationText('ミドリチュウオウ', station)).toBe('correct')
  })

  it('軽い誤字は確認を求め、大きく異なる名前は不正解にする', () => {
    const station = demoNetwork.stations.find((item) => item.stableId === 'demo:station:midori')!
    expect(evaluateStationText('みどりちゅおう', station)).toBe('confirm')
    expect(evaluateStationText('みなと', station)).toBe('incorrect')
  })
})
