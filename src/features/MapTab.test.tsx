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

  it('uses a taller map canvas without changing other maps', () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    render(<MapTab />)

    expect(screen.getByTestId('rail-map-svg')).toHaveClass('tall-rail-map')
    expect(screen.getByTestId('rail-map-svg')).toHaveAttribute('viewBox', '0 0 400 480')
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

  it('changes the station information panel through three sizes', () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    render(<MapTab />)

    expect(screen.getByRole('article', { name: /小サイズ/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '駅情報パネルを大きくする' }))
    expect(screen.getByRole('article', { name: /中サイズ/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '駅情報パネルを大きくする' }))
    expect(screen.getByRole('article', { name: /大サイズ/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '駅情報パネルを小さくする' }))
    expect(screen.getByRole('article', { name: /中サイズ/ })).toBeInTheDocument()
  })

  it('opens the panel when a station is selected on the map', () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    render(<MapTab />)

    fireEvent.click(screen.getByRole('button', { name: '春風駅' }))

    expect(screen.getByRole('article', { name: /春風駅の情報パネル、中サイズ/ })).toBeInTheDocument()
  })

  it('opens the panel one step when its handle is dragged upward', () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    render(<MapTab />)
    const handle = screen.getByRole('separator', { name: '駅情報パネルの大きさを変更' })

    fireEvent.pointerDown(handle, { pointerId: 7, clientY: 220 })
    fireEvent.pointerMove(handle, { pointerId: 7, clientY: 170 })
    fireEvent.pointerUp(handle, { pointerId: 7, clientY: 170 })

    expect(screen.getByRole('article', { name: /中サイズ/ })).toBeInTheDocument()
  })

  it('shows line endpoints and stations when a line is selected on the map', () => {
    vi.spyOn(db.settings, 'get').mockResolvedValue(undefined)
    render(<MapTab />)

    fireEvent.click(screen.getByRole('button', { name: 'あおぞら線を選択' }))

    expect(screen.getByRole('article', { name: /あおぞら線の路線情報パネル、中サイズ/ })).toBeInTheDocument()
    expect(screen.getByText('きせつ鉄道（架空）')).toBeInTheDocument()
    expect(screen.getByText('所属駅（4駅）')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /春風.*始点/ }))
    expect(screen.getByRole('article', { name: /春風駅の情報パネル、中サイズ/ })).toBeInTheDocument()
  })
})
