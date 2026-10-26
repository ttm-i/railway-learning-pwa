import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    render(<RouteSearchView />)

    expect(await screen.findByRole('heading', { name: /春風.*星見ヶ丘/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '両方で同じ候補' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('経由駅を追加'), { target: { value: 'demo:station:hikari' } })
    expect(await screen.findByRole('button', { name: 'ひかり台を削除' })).toBeInTheDocument()
    expect(screen.getAllByText('ひかり台').length).toBeGreaterThan(0)

    await waitFor(async () => {
      const saved = await db.settings.get('routeSearchOptions')
      expect(saved?.value).toMatchObject({ viaIds: ['demo:station:hikari'] })
    })
  })
})
