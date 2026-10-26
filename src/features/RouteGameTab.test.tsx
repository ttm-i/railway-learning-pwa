import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(screen.getByRole('button', { name: /みどり中央.*ゆうひ線/ })).toBeInTheDocument()
    expect(screen.queryByText('検索結果')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.route-highlight')).toHaveLength(0)
  })
})
