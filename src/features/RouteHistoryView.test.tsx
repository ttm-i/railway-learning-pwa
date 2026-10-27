import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RouteHistoryView } from './RouteHistoryView'
import { db } from '../storage/db'

describe('RouteHistoryView', () => {
  beforeEach(async () => {
    await db.routeHistory.clear()
    await db.deletedRecords.clear()
    await db.routeHistory.add({
      id: 'history-test',
      createdAt: '2026-10-27T06:00:00.000Z',
      datasetVersion: 'demo-2026-10-26-v1',
      path: [
        'demo:station:harukaze',
        'demo:station:midori',
        'demo:station:komorebi',
        'demo:station:hoshimi'
      ],
      lineIds: ['demo:line:aozora', 'demo:line:yuhi'],
      metrics: { railSegments: 3, transfers: 1, revisits: 0, walks: 0 }
    })
  })

  afterEach(async () => {
    cleanup()
    await db.routeHistory.clear()
    await db.deletedRecords.clear()
  })

  it('searches, expands, and asks before deleting a record', async () => {
    render(<RouteHistoryView />)

    expect(await screen.findByRole('heading', { name: /春風.*星見ヶ丘/ })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('駅名・路線名で探す'), { target: { value: '存在しない' } })
    expect(await screen.findByText('条件に合う記録がありません')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('駅名・路線名で探す'), { target: { value: 'ゆうひ' } })
    expect(await screen.findByText('ゆうひ線')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '通った順番を見る' }))
    expect(screen.getByText('こもれび')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除' }))
    expect(screen.getByRole('alertdialog', { name: '経路記録の削除確認' })).toBeInTheDocument()
    expect(screen.getByText('削除すると元に戻せません。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'この記録を削除' }))
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(async () => expect(await db.deletedRecords.get('routeHistory:history-test')).toMatchObject({ recordId: 'history-test' }))
  })
})
