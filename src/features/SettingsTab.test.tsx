import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../storage/db'
import { SettingsTab } from './SettingsTab'

const tables = [db.settings, db.manualMastery, db.quizAnswers, db.quizSuspension, db.routeSuspension, db.routeHistory]

describe('SettingsTab backup', () => {
  const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')
  const originalCanShare = Object.getOwnPropertyDescriptor(navigator, 'canShare')

  beforeEach(async () => Promise.all(tables.map((table) => table.clear())))

  afterEach(async () => {
    cleanup()
    await Promise.all(tables.map((table) => table.clear()))
    if (originalShare) Object.defineProperty(navigator, 'share', originalShare)
    else Reflect.deleteProperty(navigator, 'share')
    if (originalCanShare) Object.defineProperty(navigator, 'canShare', originalCanShare)
    else Reflect.deleteProperty(navigator, 'canShare')
  })

  it('hands a JSON backup to the share menu without changing records', async () => {
    await db.quizAnswers.put({
      id: 'answer-1', questionId: 'question-1', answeredAt: '2026-10-27T00:00:00.000Z',
      answer: 'demo:station:sakura', correct: true, datasetVersion: 'demo-2026-10-26-v1'
    })
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })

    render(<SettingsTab onOpenOnboarding={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'バックアップを書き出す' }))

    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    const sharedFile = share.mock.calls[0][0].files[0] as File
    expect(sharedFile.name).toMatch(/^railway-learning-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/)
    expect(sharedFile.type).toBe('application/json')
    expect(await db.quizAnswers.count()).toBe(1)
    expect(await screen.findByText('共有メニューを閉じました。選んだ保存先にファイルがあるかご確認ください。')).toBeInTheDocument()
  })
})
