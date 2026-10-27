import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../storage/db'
import { createBackup, createBackupFile } from '../storage/backup'
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

  it('previews a selected backup without restoring it', async () => {
    await db.manualMastery.put({ stationId: 'demo:station:sakura', learned: true, updatedAt: '2026-10-27T00:00:00.000Z' })
    const backup = await createBackup('2026-10-27T12:34:56.000Z')
    const file = createBackupFile(backup)
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(backup) })

    render(<SettingsTab onOpenOnboarding={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('バックアップファイルを確認する'), { target: { files: [file] } })

    const preview = await screen.findByLabelText('バックアップ内容の確認結果')
    expect(preview).toHaveTextContent('覚えた駅1件')
    expect(preview).toHaveTextContent('内容を表示しただけで、端末内のデータは変更していません。')
    expect(await db.manualMastery.count()).toBe(1)
  })

  it('checks writable storage without changing existing settings', async () => {
    await db.settings.put({ key: 'existing', value: 'keep' })
    render(<SettingsTab onOpenOnboarding={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: '保存状態を確認する' }))

    expect(await screen.findByText('端末内への保存を確認しました')).toBeInTheDocument()
    expect(await db.settings.get('__storageHealthCheck')).toBeUndefined()
    expect(await db.settings.get('existing')).toMatchObject({ value: 'keep' })
  })
})
