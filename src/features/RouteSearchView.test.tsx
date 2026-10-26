import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../storage/db'
import { RouteSearchView } from './RouteSearchView'

describe('RouteSearchView', () => {
  beforeEach(async () => {
    await db.settings.delete('routeSearchOptions')
  })

  afterEach(async () => {
    cleanup()
    await db.settings.delete('routeSearchOptions')
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
})
