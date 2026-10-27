import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../storage/db'
import { RouteSearchView } from './RouteSearchView'

describe('RouteSearchView', () => {
  beforeEach(async () => {
    await db.settings.delete('routeSearchOptions')
    await db.settings.delete('routeSearchFavorites')
    await db.deletedRecords.clear()
  })

  afterEach(async () => {
    cleanup()
    await db.settings.delete('routeSearchOptions')
    await db.settings.delete('routeSearchFavorites')
    await db.deletedRecords.clear()
  })

  it('shows a candidate, applies an ordered via station, and saves conditions', async () => {
    const onStartGame = vi.fn()
    render(<RouteSearchView onStartGame={onStartGame} />)

    expect(await screen.findByRole('heading', { name: /春風.*星見ヶ丘/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '両方で同じ候補' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('経由駅を追加'), { target: { value: 'demo:station:hikari' } })
    expect(await screen.findByRole('button', { name: 'ひかり台を削除' })).toBeInTheDocument()
    expect(screen.getAllByText('ひかり台').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'この条件でゲーム開始' }))
    expect(onStartGame).toHaveBeenCalledWith(expect.objectContaining({
      startId: 'demo:station:harukaze',
      destinationId: 'demo:station:hoshimi',
      viaIds: ['demo:station:hikari']
    }))

    await waitFor(async () => {
      const saved = await db.settings.get('routeSearchOptions')
      expect(saved?.value).toMatchObject({ viaIds: ['demo:station:hikari'] })
    })

    fireEvent.click(screen.getByLabelText('あおぞら線'))
    expect(await screen.findByText('現在の条件では、確認済みの接続だけで経路を見つけられませんでした。')).toBeInTheDocument()
    await waitFor(async () => {
      const saved = await db.settings.get('routeSearchOptions')
      expect(saved?.value).toMatchObject({ excludedLineIds: ['demo:line:aozora'] })
    })
  })

  it('saves, loads, and safely deletes a favorite search', async () => {
    render(<RouteSearchView />)
    await screen.findByRole('heading', { name: /春風.*星見ヶ丘/ })

    fireEvent.change(screen.getByLabelText('出発駅'), { target: { value: 'demo:station:sakura' } })
    fireEvent.change(screen.getByLabelText('この検索条件に名前を付ける'), { target: { value: '帰り道' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('「帰り道」を保存しました。')).toBeInTheDocument()
    await waitFor(async () => {
      const record = await db.settings.get('routeSearchFavorites')
      expect(record?.value).toEqual([expect.objectContaining({ name: '帰り道', startId: 'demo:station:sakura' })])
    })

    fireEvent.change(screen.getByLabelText('出発駅'), { target: { value: 'demo:station:harukaze' } })
    fireEvent.click(screen.getByRole('button', { name: /帰り道.*さくら野.*星見ヶ丘/ }))
    expect(screen.getByLabelText('出発駅')).toHaveValue('demo:station:sakura')

    fireEvent.click(screen.getByRole('button', { name: '帰り道を削除' }))
    expect(screen.getByText('削除しますか？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(await screen.findByText('「帰り道」を削除しました。')).toBeInTheDocument()
    await waitFor(async () => {
      const record = await db.settings.get('routeSearchFavorites')
      expect(record?.value).toEqual([])
    })
    expect((await db.deletedRecords.where('recordType').equals('routeSearchFavorite').first())?.recordId).toBeTruthy()
  })
})
