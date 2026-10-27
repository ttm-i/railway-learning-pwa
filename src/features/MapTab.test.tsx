import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../storage/db'
import { MapTab } from './MapTab'

describe('MapTab viewport', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('restores and saves the last map viewport', async () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue({ key: 'mapViewport', value: { centerX: 230, centerY: 150, zoom: 2 } })
    const save = vi.spyOn(db.settings, 'put').mockResolvedValue('mapViewport')
    render(<MapTab />)

    await waitFor(() => expect(screen.getByText('200%')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '地図を縮小' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith({
      key: 'mapViewport',
      value: expect.objectContaining({ zoom: 2 / 1.35 })
    }))
  })

  it('zooms to a station selected from search', async () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    const { container } = render(<MapTab />)
    fireEvent.change(screen.getByRole('searchbox', { name: '駅名・路線名で探す' }), { target: { value: '春風' } })
    const result = container.querySelector<HTMLButtonElement>('.search-results button')
    expect(result).not.toBeNull()
    fireEvent.click(result!)

    expect(await screen.findByText('180%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '春風' })).toBeInTheDocument()
  })
})
