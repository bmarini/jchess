import { describe, it, expect, beforeEach } from 'vitest'
import { parseFEN, resetPieceIds, boardGet, STARTING_FEN } from './board.js'
import { parsePGN } from './pgn.js'
import { buildTransitions, GamePlayer } from './transitions.js'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadExample(name: string): string {
  return readFileSync(join(__dirname, '..', 'examples', name), 'utf-8')
}

beforeEach(() => resetPieceIds())

function makePlayer(pgn: string): GamePlayer {
  const game = parsePGN(pgn)
  const initial = parseFEN(STARTING_FEN)
  const result = buildTransitions(game, initial)
  return new GamePlayer(result)
}

// ── buildTransitions ──────────────────────────────────────────────────────────

describe('buildTransitions', () => {
  it('produces one transition per move', () => {
    const game = parsePGN('1. e4 e5 2. Nf3')
    const initial = parseFEN(STARTING_FEN)
    const { transitions } = buildTransitions(game, initial)
    expect(transitions).toHaveLength(3)
  })

  it('each transition has forward and backward commands', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), parseFEN(STARTING_FEN))
    const t = transitions[0]!
    expect(t.forward.length).toBeGreaterThan(0)
    expect(t.backward.length).toBeGreaterThan(0)
  })

  it('forward[0] for e4 is a move command from e2 to e4', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), parseFEN(STARTING_FEN))
    const cmd = transitions[0]!.forward[0]!
    expect(cmd.op).toBe('move')
    if (cmd.op !== 'move') return
    expect(cmd.from).toBe('e2')
    expect(cmd.to).toBe('e4')
  })

  it('backward[0] for e4 is a move command from e4 back to e2', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4'), parseFEN(STARTING_FEN))
    const cmd = transitions[0]!.backward[0]!
    expect(cmd.op).toBe('move')
    if (cmd.op !== 'move') return
    expect(cmd.from).toBe('e4')
    expect(cmd.to).toBe('e2')
  })

  it('capture generates a remove command in forward and add command in backward', () => {
    // e4 e5 Nf3 Nc6 d4 exd4 — white pawn captures on d4... no, let's use simple Nxe5
    // After e4 e5 Nf3 Nc6 d4 exd4 — exd4 is a capture
    const pgn = '1. e4 e5 2. d4 exd4'
    const { transitions } = buildTransitions(parsePGN(pgn), parseFEN(STARTING_FEN))
    const captureT = transitions[3]!  // exd4
    const removeCmd = captureT.forward.find(c => c.op === 'remove')
    expect(removeCmd).toBeDefined()
    const addCmd = captureT.backward.find(c => c.op === 'add')
    expect(addCmd).toBeDefined()
  })

  it('promotion generates remove+add in forward', () => {
    const fen = '8/P7/8/8/8/8/8/4K2k w - - 0 1'
    const game = parsePGN('1. a8=Q')
    const initial = parseFEN(fen)
    const { transitions } = buildTransitions(game, initial)
    const t = transitions[0]!
    expect(t.forward.some(c => c.op === 'remove')).toBe(true)
    expect(t.forward.some(c => c.op === 'add')).toBe(true)
  })

  it('castling kingside moves both king and rook', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
    const game = parsePGN('1. O-O')
    const { transitions } = buildTransitions(game, parseFEN(fen))
    const t = transitions[0]!
    expect(t.forward).toHaveLength(2)  // king + rook
    const kingMove = t.forward.find(c => c.op === 'move' && (c as any).to === 'g1')
    expect(kingMove).toBeDefined()
    const rookMove = t.forward.find(c => c.op === 'move' && (c as any).to === 'f1')
    expect(rookMove).toBeDefined()
  })

  it('attaches san to each transition', () => {
    const { transitions } = buildTransitions(parsePGN('1. e4 e5'), parseFEN(STARTING_FEN))
    expect(transitions[0]!.san).toBe('e4')
    expect(transitions[1]!.san).toBe('e5')
  })

  it('produces no warnings for the fischer-spassky game', () => {
    const game = parsePGN(loadExample('fischer-spassky.pgn'))
    const { warnings } = buildTransitions(game, parseFEN(STARTING_FEN))
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the with-queening game', () => {
    const game = parsePGN(loadExample('with-queening.pgn'))
    const { warnings } = buildTransitions(game, parseFEN(STARTING_FEN))
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the middle-game', () => {
    const game = parsePGN(loadExample('middle-game.pgn'))
    const { warnings } = buildTransitions(game, parseFEN(STARTING_FEN))
    expect(warnings).toHaveLength(0)
  })

  it('produces no warnings for the unambiguous-knight game', () => {
    const game = parsePGN(loadExample('unambiguous-knight.pgn'))
    const { warnings } = buildTransitions(game, parseFEN(STARTING_FEN))
    expect(warnings).toHaveLength(0)
  })
})

// ── GamePlayer ────────────────────────────────────────────────────────────────

describe('GamePlayer – navigation', () => {
  it('starts at halfmove 0', () => {
    const player = makePlayer('1. e4 e5')
    expect(player.halfmove).toBe(0)
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
    const player = makePlayer('1. e4')
    expect(player.stepBackward()).toBeNull()
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
    const player = makePlayer('1. e4 e5 2. Nf3')
    expect(player.totalMoves).toBe(3)
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

describe('GamePlayer – stateAt', () => {
  it('stateAt(0) is the initial state', () => {
    const player = makePlayer('1. e4 e5')
    const s = player.stateAt(0)
    // e2 should have white pawn
    expect(boardGet(s.board, 'e2')?.type).toBe('P')
    expect(boardGet(s.board, 'e4')).toBeNull()
  })

  it('stateAt(1) has pawn on e4', () => {
    const player = makePlayer('1. e4 e5')
    const s = player.stateAt(1)
    expect(boardGet(s.board, 'e4')?.type).toBe('P')
    expect(boardGet(s.board, 'e2')).toBeNull()
  })

  it('stateAt(2) has pawn on e4 and e5', () => {
    const player = makePlayer('1. e4 e5')
    const s = player.stateAt(2)
    expect(boardGet(s.board, 'e4')?.color).toBe('w')
    expect(boardGet(s.board, 'e5')?.color).toBe('b')
  })
})

// ── Full game integration ─────────────────────────────────────────────────────

describe('full game: fischer-spassky', () => {
  const game = parsePGN(loadExample('fischer-spassky.pgn'))
  const initial = parseFEN(STARTING_FEN)
  const result = buildTransitions(game, initial)
  const player = new GamePlayer(result)

  it('has 85 transitions', () => {
    expect(player.totalMoves).toBe(85)
  })

  it('stateAt final position has white pawn on b3', () => {
    const s = player.stateAt(85)
    expect(boardGet(s.board, 'b3')?.type).toBe('P')
    expect(boardGet(s.board, 'b3')?.color).toBe('w')
  })
})
