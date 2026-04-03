import { describe, it, expect } from 'vitest'
import { Position } from './board.js'
import { parsePGN } from './pgn.js'
import { buildTransitions, GamePlayer } from './transitions.js'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadExample(name: string): string {
  return readFileSync(join(__dirname, '..', 'examples', name), 'utf-8')
}

function makePlayer(pgn: string): GamePlayer {
  const result = buildTransitions(parsePGN(pgn), Position.starting())
  return new GamePlayer(result)
}

// ── buildTransitions ──────────────────────────────────────────────────────────

describe('buildTransitions', () => {
  it('produces one transition per move', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4 e5 2. Nf3'), Position.starting())
    expect(transitions).toHaveLength(3)
  })

  it('each transition has forward and backward commands', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), Position.starting())
    const t = transitions[0]!
    expect(t.forward.length).toBeGreaterThan(0)
    expect(t.backward.length).toBeGreaterThan(0)
  })

  it('forward[0] for e4 is a move command from e2 to e4', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), Position.starting())
    const cmd = transitions[0]!.forward[0]!
    expect(cmd.op).toBe('move')
    if (cmd.op !== 'move') return
    expect(cmd.from).toBe('e2')
    expect(cmd.to).toBe('e4')
  })

  it('backward[0] for e4 is a move command from e4 back to e2', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), Position.starting())
    const cmd = transitions[0]!.backward[0]!
    expect(cmd.op).toBe('move')
    if (cmd.op !== 'move') return
    expect(cmd.from).toBe('e4')
    expect(cmd.to).toBe('e2')
  })

  it('capture generates a remove command in forward and add command in backward', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4 e5 2. d4 exd4'), Position.starting())
    const captureT = transitions[3]!
    expect(captureT.forward.some(c => c.op === 'remove')).toBe(true)
    expect(captureT.backward.some(c => c.op === 'add')).toBe(true)
  })

  it('promotion generates remove+add in forward', () => {
    const { transitions } = buildTransitions(
      parsePGN('1. a8=Q'),
      Position.fromFEN('8/P7/8/8/8/8/8/4K2k w - - 0 1'),
    )
    const t = transitions[0]!
    expect(t.forward.some(c => c.op === 'remove')).toBe(true)
    expect(t.forward.some(c => c.op === 'add')).toBe(true)
  })

  it('castling moves both king and rook', () => {
    const { transitions } = buildTransitions(
      parsePGN('1. O-O'),
      Position.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'),
    )
    const t = transitions[0]!
    expect(t.forward).toHaveLength(2)
    expect(t.forward.some(c => c.op === 'move' && (c as any).to === 'g1')).toBe(true)
    expect(t.forward.some(c => c.op === 'move' && (c as any).to === 'f1')).toBe(true)
  })

  it('attaches san to each transition', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4 e5'), Position.starting())
    expect(transitions[0]!.san).toBe('e4')
    expect(transitions[1]!.san).toBe('e5')
  })

  it('produces no warnings for the fischer-spassky game', () => {
    const { warnings } = buildTransitions(parsePGN(loadExample('fischer-spassky.pgn')), Position.starting())
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the with-queening game', () => {
    const { warnings } = buildTransitions(parsePGN(loadExample('with-queening.pgn')), Position.starting())
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the middle-game', () => {
    const { warnings } = buildTransitions(parsePGN(loadExample('middle-game.pgn')), Position.starting())
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the unambiguous-knight game', () => {
    const { warnings } = buildTransitions(parsePGN(loadExample('unambiguous-knight.pgn')), Position.starting())
    expect(warnings).toHaveLength(0)
  })
})

// ── GamePlayer ────────────────────────────────────────────────────────────────

describe('GamePlayer – navigation', () => {
  it('starts at halfmove 0', () => {
    expect(makePlayer('1. e4 e5').halfmove).toBe(0)
  })

  it('stepForward increments halfmove', () => {
    const player = makePlayer('1. e4 e5')
    player.stepForward()
    expect(player.halfmove).toBe(1)
  })

  it('stepBackward decrements halfmove', () => {
    const player = makePlayer('1. e4 e5')
    player.stepForward()
    player.stepForward()
    player.stepBackward()
    expect(player.halfmove).toBe(1)
  })

  it('stepForward returns null at end of game', () => {
    const player = makePlayer('1. e4')
    player.stepForward()
    expect(player.stepForward()).toBeNull()
  })

  it('stepBackward returns null at start of game', () => {
    expect(makePlayer('1. e4').stepBackward()).toBeNull()
  })

  it('canGoForward is false at end', () => {
    const player = makePlayer('1. e4')
    player.stepForward()
    expect(player.canGoForward()).toBe(false)
  })

  it('canGoBackward is false at start', () => {
    expect(makePlayer('1. e4').canGoBackward()).toBe(false)
  })

  it('currentSAN is null at start', () => {
    expect(makePlayer('1. e4 e5').currentSAN).toBeNull()
  })

  it('currentSAN is e4 after one stepForward', () => {
    const player = makePlayer('1. e4 e5')
    player.stepForward()
    expect(player.currentSAN).toBe('e4')
  })

  it('totalMoves matches move count', () => {
    expect(makePlayer('1. e4 e5 2. Nf3').totalMoves).toBe(3)
  })
})

describe('GamePlayer – jumpTo', () => {
  it('jumpTo sets halfmove directly', () => {
    const player = makePlayer('1. e4 e5 2. Nf3 Nc6')
    player.jumpTo(3)
    expect(player.halfmove).toBe(3)
  })

  it('jumpTo clamps to valid range', () => {
    const player = makePlayer('1. e4 e5')
    player.jumpTo(999)
    expect(player.halfmove).toBe(2)
    player.jumpTo(-5)
    expect(player.halfmove).toBe(0)
  })
})

describe('GamePlayer – positionAt', () => {
  it('positionAt(0) is the initial position', () => {
    const player = makePlayer('1. e4 e5')
    const pos = player.positionAt(0)
    expect(pos.get('e2')).toMatchObject({ type: 'P', color: 'w' })
    expect(pos.get('e4')).toBeNull()
  })

  it('positionAt(1) has pawn on e4', () => {
    const player = makePlayer('1. e4 e5')
    const pos = player.positionAt(1)
    expect(pos.get('e4')).toMatchObject({ type: 'P', color: 'w' })
    expect(pos.get('e2')).toBeNull()
  })

  it('positionAt(2) has pawns on e4 and e5', () => {
    const player = makePlayer('1. e4 e5')
    const pos = player.positionAt(2)
    expect(pos.get('e4')?.color).toBe('w')
    expect(pos.get('e5')?.color).toBe('b')
  })
})

// ── RAV: variation transitions ────────────────────────────────────────────────

describe('buildTransitions – RAV', () => {
  it('attaches variation transitions to the parent move', () => {
    // 1.e4 (1.d4 d5) e5 — variation is on e4
    const { transitions } = buildTransitions(parsePGN('1. e4 (1. d4 d5) e5'), Position.starting())
    expect(transitions[0]!.variations).toHaveLength(1)
    expect(transitions[0]!.variations[0]).toHaveLength(2)
    expect(transitions[0]!.variations[0]![0]!.san).toBe('d4')
    expect(transitions[0]!.variations[0]![1]!.san).toBe('d5')
  })

  it('variation transitions start from the same position as the parent move', () => {
    // 1.e4 e5 (1...c5 2.Nf3) — variation is on e5, starts from after e4
    const { transitions } = buildTransitions(parsePGN('1. e4 e5 (1... c5 2. Nf3) 2. Nf3'), Position.starting())
    const varT = transitions[1]!.variations[0]!
    // c5 should be a valid move from after e4 — transition commands should be non-empty
    expect(varT[0]!.forward.length).toBeGreaterThan(0)
    expect(varT[0]!.san).toBe('c5')
  })

  it('nested variation transitions are built recursively', () => {
    // 1.e4 e5 (1...c5 2.Nf3 (2.d4)) — nested variation on Nf3
    const { transitions } = buildTransitions(
      parsePGN('1. e4 e5 (1... c5 2. Nf3 (2. d4)) 2. Nf3'),
      Position.starting(),
    )
    const outerVar = transitions[1]!.variations[0]!
    expect(outerVar[1]!.san).toBe('Nf3')
    expect(outerVar[1]!.variations[0]![0]!.san).toBe('d4')
    expect(outerVar[1]!.variations[0]![0]!.forward.length).toBeGreaterThan(0)
  })

  it('produces no warnings for the with-rav game', () => {
    const { warnings } = buildTransitions(parsePGN(loadExample('with-rav.pgn')), Position.starting())
    expect(warnings).toHaveLength(0)
  })
})

// ── GamePlayer – variation navigation ─────────────────────────────────────────

describe('GamePlayer – variation navigation', () => {
  it('isInVariation is false on main line', () => {
    expect(makePlayer('1. e4 (1. d4) e5').isInVariation).toBe(false)
  })

  it('enterVariation enters the variation and isInVariation becomes true', () => {
    // 1.e4 (1.d4 d5) e5 — variation is on e4 (transitions[0]), enter from halfmove=0
    const player = makePlayer('1. e4 (1. d4 d5) e5')
    player.enterVariation(0)
    expect(player.isInVariation).toBe(true)
  })

  it('enterVariation positions the player at the start of the variation', () => {
    const player = makePlayer('1. e4 (1. d4 d5) e5')
    player.enterVariation(0)
    expect(player.halfmove).toBe(0)
    expect(player.totalMoves).toBe(2)  // d4, d5
  })

  it('stepForward in a variation plays variation moves', () => {
    const player = makePlayer('1. e4 (1. d4 d5) e5')
    player.enterVariation(0)
    const cmds = player.stepForward()
    expect(cmds).not.toBeNull()
    expect(player.currentSAN).toBe('d4')
  })

  it('exitVariation returns to main line', () => {
    const player = makePlayer('1. e4 (1. d4 d5) e5')
    player.enterVariation(0)
    player.exitVariation()
    expect(player.isInVariation).toBe(false)
    expect(player.halfmove).toBe(0)
  })

  it('exitVariation at root has no effect', () => {
    const player = makePlayer('1. e4 e5')
    player.exitVariation()
    expect(player.isInVariation).toBe(false)
    expect(player.halfmove).toBe(0)
  })

  it('can navigate nested variations', () => {
    // outer var on e5 (transitions[1]): c5 Nf3; inner var on Nf3: d4
    const player = makePlayer('1. e4 e5 (1... c5 2. Nf3 (2. d4)) 2. Nf3')
    // Step to halfmove=1 (after e4) so transitions[1] (e5) is accessible
    player.stepForward()
    // Enter outer variation (c5, Nf3)
    player.enterVariation(0)
    expect(player.totalMoves).toBe(2)  // c5, Nf3
    player.stepForward()  // play c5, now at halfmove=1 inside variation
    // Nf3 is transitions[1] of the outer var, which has a nested variation
    player.enterVariation(0)
    expect(player.isInVariation).toBe(true)
    expect(player.totalMoves).toBe(1)  // d4
    player.stepForward()
    expect(player.currentSAN).toBe('d4')
  })

  it('positionAt(0) inside a variation is the branch point position', () => {
    // 1.e4 (1.d4 d5) e5 — variation on e4 starts from initial position
    const player = makePlayer('1. e4 (1. d4 d5) e5')
    const branchPos = player.positionAt(0)  // initial position (before e4)
    player.enterVariation(0)
    const varStart = player.positionAt(0)
    // The variation (1.d4) starts from the same position as the main-line e4
    expect(varStart.get('e2')).toMatchObject({ type: 'P', color: 'w' })
    expect(varStart.toFEN()).toBe(branchPos.toFEN())
  })
})

// ── Full game integration ─────────────────────────────────────────────────────

describe('full game: fischer-spassky', () => {
  const result = buildTransitions(
    parsePGN(loadExample('fischer-spassky.pgn')),
    Position.starting(),
  )
  const player = new GamePlayer(result)

  it('has 85 transitions', () => {
    expect(player.totalMoves).toBe(85)
  })

  it('final position has white pawn on b3', () => {
    const pos = player.positionAt(85)
    expect(pos.get('b3')).toMatchObject({ type: 'P', color: 'w' })
  })
})
