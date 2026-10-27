import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../storage/db'
import { QuizTab } from './QuizTab'

describe('QuizTab text answers', () => {
  beforeEach(async () => {
    await db.quizAnswers.clear()
    await db.quizSuspension.clear()
  })

  afterEach(async () => {
    cleanup()
    await db.quizAnswers.clear()
    await db.quizSuspension.clear()
  })

  it('accepts a kana answer with spaces and the station suffix', async () => {
    render(<QuizTab />)
    fireEvent.click(await screen.findByRole('button', { name: '駅名入力' }))
    fireEvent.change(screen.getByLabelText('駅名を入力してください'), { target: { value: ' ミドリ チュウオウ駅 ' } })
    fireEvent.click(screen.getByRole('button', { name: '回答する' }))

    expect(await screen.findByText('正解です！')).toBeInTheDocument()
    await waitFor(async () => expect(await db.quizAnswers.count()).toBe(1))
    expect((await db.quizAnswers.toArray())[0]).toMatchObject({ textAnswer: ' ミドリ チュウオウ駅 ', correct: true })
  })

  it('asks before grading a minor typo', async () => {
    render(<QuizTab />)
    fireEvent.click(await screen.findByRole('button', { name: '駅名入力' }))
    fireEvent.change(screen.getByLabelText('駅名を入力してください'), { target: { value: 'みどりちゅおう' } })
    fireEvent.click(screen.getByRole('button', { name: '回答する' }))

    expect(await screen.findByText('「みどり中央」のつもりで入力しましたか？')).toBeInTheDocument()
    expect(await db.quizAnswers.count()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'はい、採点する' }))
    expect(await screen.findByText('正解です！')).toBeInTheDocument()
  })

  it('restores an unfinished text entry', async () => {
    await db.quizSuspension.put({
      id: 'active', questionIds: ['q-ao-1', 'q-ao-2', 'q-yu-1'], currentIndex: 0,
      format: 'text', textDraft: 'みどり', correctCount: 0,
      datasetVersion: 'demo-2026-10-26-v1', updatedAt: '2026-10-27T00:00:00.000Z'
    })

    render(<QuizTab />)

    expect(await screen.findByDisplayValue('みどり')).toBeInTheDocument()
    expect(screen.getByText('前回の続きから再開しました')).toBeInTheDocument()
  })
})
