import { describe, it, expect } from 'vitest'
import { Position } from './board.js'
import { parsePGN } from './pgn.js'
import { buildTransitions } from './transitions.js'
import { exportPGN } from './export.js'

function roundTrip(pgn: string): string {
  const game = parsePGN(pgn)
  const result = buildTransitions(game, Position.starting())
  return exportPGN(game.headers, result.transitions, game.preAnnotation)
}

describe('exportPGN', () => {
  it('round-trips a simple game', () => {
    const output = roundTrip('[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0')
    expect(output).toContain('1. e4 e5 2. Nf3 Nc6')
    expect(output).toContain('1-0')
  })

  it('works without headers', () => {
    const output = roundTrip('1. e4 e5 2. Nf3 *')
    expect(output).toBe('1. e4 e5 2. Nf3')
  })

  it('preserves headers', () => {
    const pgn = '[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 1-0'
    const output = roundTrip(pgn)
    expect(output).toContain('[White "Alice"]')
    expect(output).toContain('[Black "Bob"]')
  })

  it('preserves annotations', () => {
    const output = roundTrip('1. e4 {Best move} e5 {Solid reply} *')
    expect(output).toContain('{Best move}')
    expect(output).toContain('{Solid reply}')
  })

  it('preserves variations', () => {
    const output = roundTrip('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *')
    expect(output).toContain('(1... c5 2. Nf3)')
  })

  it('preserves nested variations', () => {
    const output = roundTrip(
      '1. e4 c5 (1... e5 2. Nf3 Nc6 3. Bb5 (3. d4 exd4 4. Nxd4)) 2. Nf3 1-0'
    )
    expect(output).toContain('(1... e5 2. Nf3 Nc6 3. Bb5 (3. d4 exd4 4. Nxd4))')
  })

  it('preserves pre-annotation', () => {
    const output = roundTrip('{This is a great game} 1. e4 e5 *')
    expect(output).toContain('{This is a great game}')
  })

  it('preserves clock metadata through round-trip', () => {
    const output = roundTrip('1. e4 {[%clk 0:30:00]} e5 {[%clk 0:29:56]} *')
    expect(output).toContain('[%clk 0:30:00]')
    expect(output).toContain('[%clk 0:29:56]')
  })

  it('preserves mixed annotation + metadata', () => {
    const output = roundTrip('1. e4 {[%clk 0:30:00] Best move} e5 *')
    expect(output).toContain('[%clk 0:30:00]')
    expect(output).toContain('Best move')
  })

  it('adds black move number after variation', () => {
    const output = roundTrip('1. e4 e5 (1... d5) 2. Nf3 *')
    // After the variation, black's move should show the move number
    expect(output).toMatch(/\(1\.\.\. d5\)/)
  })
})
