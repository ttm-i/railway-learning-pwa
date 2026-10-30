import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../storage/db'
import { RouteGameTab } from './RouteGameTab'

describe('RouteGameTab search handoff', () => {
  beforeEach(async () => {
    await db.routeSuspension.clear()
    await db.routeHistory.clear()
    await db.settings.delete('routeSearchOptions')
  })

  afterEach(async () => {
    cleanup()
    await db.routeSuspension.clear()
    await db.routeHistory.clear()
    await db.settings.delete('routeSearchOptions')
  })

  it('hands conditions to the game without showing the searched path', async () => {
    render(<RouteGameTab />)
    fireEvent.click(await screen.findByRole('button', { name: '検索' }))

    fireEvent.change(await screen.findByLabelText('出発駅'), { target: { value: 'demo:station:sakura' } })
    fireEvent.click(screen.getByLabelText('あおぞら線'))
    fireEvent.click(await screen.findByRole('button', { name: 'この条件でゲーム開始' }))

    expect(await screen.findByText('検索条件を引き継ぎました。検索結果は隠しています。')).toBeInTheDocument()
    expect(screen.getByText('引き継いだ条件')).toBeInTheDocument()
    const inheritedConditions = screen.getByText('引き継いだ条件').closest<HTMLElement>('.game-conditions')
    expect(inheritedConditions).not.toBeNull()
    expect(within(inheritedConditions!).getByText('あおぞら線')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /みどり中央.*ゆうひ線/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'さくら野駅' }))
    expect(screen.getByRole('button', { name: /みどり中央.*ゆうひ線/ })).toBeInTheDocument()
    expect(screen.queryByText('検索結果')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.route-highlight')).toHaveLength(0)
  })

  it('pauses map following after manual zoom and resumes at the current station', async () => {
    render(<RouteGameTab />)
    await screen.findByRole('button', { name: '現在駅を表示中' })

    fireEvent.click(screen.getByRole('button', { name: '地図を拡大' }))
    expect(screen.getByText('135%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在駅へ戻る' })).toBeInTheDocument()
    const pausedViewBox = screen.getByTestId('rail-map-svg').getAttribute('viewBox')

    fireEvent.click(screen.getByRole('button', { name: '春風駅' }))
    fireEvent.click(screen.getByRole('button', { name: /みどり中央.*あおぞら線/ }))
    await waitFor(() => expect(screen.getByText('次の駅へ進みました。')).toBeInTheDocument())
    expect(screen.getByTestId('rail-map-svg')).toHaveAttribute('viewBox', pausedViewBox)

    fireEvent.click(screen.getByRole('button', { name: '現在駅へ戻る' }))
    expect(screen.getByRole('button', { name: '現在駅を表示中' })).toBeInTheDocument()
    expect(screen.getByTestId('rail-map-svg')).not.toHaveAttribute('viewBox', pausedViewBox)
  })

  it('reveals candidates only after selecting the current station and hides them after moving', async () => {
    render(<RouteGameTab />)
    await screen.findByText('地図上の現在駅をタップすると、次に進める駅が地図と一覧に表示されます。')

    expect(screen.queryByRole('button', { name: /みどり中央.*あおぞら線/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '春風駅' }))

    expect(screen.getByText('次に進める駅を1件表示しました。')).toBeInTheDocument()
    expect(screen.getByText('1. みどり中央')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /みどり中央.*あおぞら線/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /みどり中央駅、候補 1、次に進めます/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /みどり中央.*あおぞら線/ }))
    await waitFor(() => expect(screen.getByText('次の駅へ進みました。')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /こもれび.*ゆうひ線/ })).not.toBeInTheDocument()
    expect(screen.getByText('地図上の現在駅をタップすると、次に進める駅が地図と一覧に表示されます。')).toBeInTheDocument()
  })

  it('toggles the destination marker independently and saves the choice', async () => {
    const { unmount } = render(<RouteGameTab />)
    const toggle = await screen.findByRole('button', { name: '目的駅の印：表示中' })

    expect(document.querySelectorAll('.destination-ring')).toHaveLength(1)
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: '目的駅の印：非表示' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelectorAll('.destination-ring')).toHaveLength(0)
    expect(screen.getByRole('button', { name: '星見ヶ丘駅' })).toBeInTheDocument()
    await waitFor(async () => expect((await db.routeSuspension.get('active'))?.showDestinationMarker).toBe(false))

    unmount()
    render(<RouteGameTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: '目的駅の印：非表示' })).toBeInTheDocument())
    expect(document.querySelectorAll('.destination-ring')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: '駅名を隠す' }))
    expect(document.querySelectorAll('.destination-ring')).toHaveLength(0)
    expect(screen.getByRole('button', { name: '星見ヶ丘駅' })).toBeInTheDocument()
  })

  it('swaps endpoints and creates a random question with different endpoints', async () => {
    render(<RouteGameTab />)
    const startSelect = await screen.findByLabelText('出発駅')
    const destinationSelect = screen.getByLabelText('目的駅')

    fireEvent.click(screen.getByRole('button', { name: '出発・目的を入替' }))
    expect(startSelect).toHaveValue('demo:station:hoshimi')
    expect(destinationSelect).toHaveValue('demo:station:harukaze')
    expect(screen.getByText('出発駅と目的駅を入れ替えました。新しい経路を始めます。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ランダム出題' }))
    expect(startSelect).not.toHaveValue((destinationSelect as HTMLSelectElement).value)
    expect(screen.getByText('ランダムな出発駅と目的駅で新しい問題を始めました。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1操作戻す' })).toBeDisabled()
  })

  it('keeps undo on the map and returns one station without revealing candidates', async () => {
    render(<RouteGameTab />)
    const undo = await screen.findByRole('button', { name: '1操作戻す' })
    expect(undo).toBeDisabled()
    expect(undo.closest('.route-game-map')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '春風駅' }))
    fireEvent.click(screen.getByRole('button', { name: /みどり中央.*あおぞら線/ }))
    expect(undo).toBeEnabled()

    fireEvent.click(undo)
    expect(screen.getByText('直前の1操作を戻しました。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '春風' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /みどり中央.*あおぞら線/ })).not.toBeInTheDocument()
  })
})
