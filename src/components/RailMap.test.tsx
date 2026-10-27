import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fullMapViewport, normalizeMapViewport, RailMap, type MapViewport } from './RailMap'

function InteractiveMap({ onSelectStation = vi.fn() }: { onSelectStation?: (stationId: string) => void }) {
  const [viewport, setViewport] = useState<MapViewport>(fullMapViewport)
  return (
    <RailMap
      interactiveViewport
      viewport={viewport}
      onViewportChange={setViewport}
      onSelectStation={onSelectStation}
    />
  )
}

describe('RailMap viewport', () => {
  afterEach(cleanup)

  it('keeps a zoomed view inside the map bounds', () => {
    expect(normalizeMapViewport({ centerX: -100, centerY: 900, zoom: 9 })).toEqual({
      centerX: 400 / 2.6 / 2,
      centerY: 350 - 350 / 2.6 / 2,
      zoom: 2.6
    })
  })

  it('zooms with controls and returns to the full map', () => {
    render(<InteractiveMap />)

    fireEvent.click(screen.getByRole('button', { name: '地図を拡大' }))
    expect(screen.getByText('135%')).toBeInTheDocument()
    expect(screen.getByTestId('rail-map-svg')).not.toHaveAttribute('viewBox', '0 0 400 350')

    fireEvent.click(screen.getByRole('button', { name: '地図全体を表示' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByTestId('rail-map-svg')).toHaveAttribute('viewBox', '0 0 400 350')
  })

  it('does not select a station when a drag ends over it', () => {
    const onSelectStation = vi.fn()
    render(<InteractiveMap onSelectStation={onSelectStation} />)
    const map = screen.getByTestId('rail-map-svg')

    fireEvent.pointerDown(map, { pointerId: 1, clientX: 180, clientY: 170 })
    fireEvent.pointerMove(map, { pointerId: 1, clientX: 210, clientY: 170 })
    fireEvent.pointerUp(map, { pointerId: 1, clientX: 210, clientY: 170 })
    fireEvent.click(screen.getByRole('button', { name: '春風駅' }))

    expect(onSelectStation).not.toHaveBeenCalled()
  })

  it('selects a line from its visible route', () => {
    const onSelectLine = vi.fn()
    render(<RailMap onSelectLine={onSelectLine} />)

    fireEvent.click(screen.getByRole('button', { name: 'あおぞら線を選択' }))

    expect(onSelectLine).toHaveBeenCalledWith('demo:line:aozora')
  })
})
