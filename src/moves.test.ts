import { describe, it, expect, beforeEach } from 'vitest'
import { parseFEN, resetPieceIds, STARTING_FEN } from './board.js'
import { findMoveSource, findPawnMoveSource, parseSAN, applyMove } from './moves.js'
import type { GameState } from './types.js'

beforeEach(() => resetPieceIds())

// ── parseSAN ──────────────────────────────────────────────────────────────────

describe('parseSAN', () => {
  it('parses a simple pawn move', () => {
    const m = parseSAN('e4')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.pieceType).toBe('P')
    expect(m.dstSquare).toBe('e4')
    expect(m.capture).toBe(false)
  })

  it('parses a piece move', () => {
    const m = parseSAN('Nf3')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.pieceType).toBe('N')
    expect(m.dstSquare).toBe('f3')
  })

  it('parses a capture', () => {
    const m = parseSAN('Nxd5')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.capture).toBe(true)
    expect(m.dstSquare).toBe('d5')
  })

  it('parses kingside castling', () => {
    expect(parseSAN('O-O')).toEqual({ kind: 'castle', side: 'K' })
  })

  it('parses queenside castling', () => {
    expect(parseSAN('O-O-O')).toEqual({ kind: 'castle', side: 'Q' })
  })

  it('parses promotion', () => {
    const m = parseSAN('e8=Q')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.promotion).toBe('Q')
    expect(m.dstSquare).toBe('e8')
  })

  it('parses pawn capture with promotion', () => {
    const m = parseSAN('exd8=R')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.promotion).toBe('R')
    expect(m.dstSquare).toBe('d8')
    expect(m.hintFile).toBe('e')
    expect(m.capture).toBe(true)
  })

  it('parses file disambiguation', () => {
    const m = parseSAN('Rae1')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.pieceType).toBe('R')
    expect(m.hintFile).toBe('a')
    expect(m.dstSquare).toBe('e1')
  })

  it('parses rank disambiguation', () => {
    const m = parseSAN('R1e5')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.hintRank).toBe('1')
    expect(m.dstSquare).toBe('e5')
  })

  it('strips check suffix', () => {
    const m = parseSAN('Nf3+')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.dstSquare).toBe('f3')
    expect(m.check).toBe(true)
  })

  it('strips checkmate suffix', () => {
    const m = parseSAN('Qxh7#')
    expect(m?.kind).toBe('normal')
    if (m?.kind !== 'normal') return
    expect(m.checkmate).toBe(true)
  })
})

// ── findMoveSource ────────────────────────────────────────────────────────────

describe('findMoveSource – knights', () => {
  it('finds the only knight that can reach f3', () => {
    const { board } = parseFEN(STARTING_FEN)
    const src = findMoveSource(board, 'N', 'w', 'f3')
    expect(src).toBe('g1')
  })

  it('finds the only knight that can reach c3', () => {
    const { board } = parseFEN(STARTING_FEN)
    const src = findMoveSource(board, 'N', 'w', 'c3')
    expect(src).toBe('b1')
  })

  it('disambiguates by file when two knights can reach d5', () => {
    // Rooks on c5 and e5 can both reach d5 — equivalent for this test with knights
    const fen = '8/8/8/2N1N3/8/8/8/4K2k w - - 0 1'
    const { board } = parseFEN(fen)
    const srcC = findMoveSource(board, 'N', 'w', 'd3', 'c', undefined)
    const srcE = findMoveSource(board, 'N', 'w', 'd3', 'e', undefined)
    expect(srcC).toBe('c5')
    expect(srcE).toBe('e5')
  })
})

describe('findMoveSource – rooks', () => {
  it('finds rook on open file', () => {
    const fen = '8/8/8/8/R7/8/8/4K2k w - - 0 1'
    const { board } = parseFEN(fen)
    expect(findMoveSource(board, 'R', 'w', 'a8')).toBe('a4')
  })

  it('disambiguates two rooks by file', () => {
    // Both rooks on rank 4 can reach d4
    const fen = '8/8/8/8/R3R3/8/8/4K2k w - - 0 1'
    const { board } = parseFEN(fen)
    expect(findMoveSource(board, 'R', 'w', 'd4', 'a')).toBe('a4')
    expect(findMoveSource(board, 'R', 'w', 'd4', 'e')).toBe('e4')
  })

  it('disambiguates two rooks by rank', () => {
    // Rooks on a1 and a8, both can reach a5 (neither blocks the other reaching a5)
    const fen = 'R7/8/8/8/8/8/8/R3K2k w - - 0 1'
    const { board } = parseFEN(fen)
    expect(findMoveSource(board, 'R', 'w', 'a5', undefined, '1')).toBe('a1')
    expect(findMoveSource(board, 'R', 'w', 'a5', undefined, '8')).toBe('a8')
  })
})

// ── findPawnMoveSource ────────────────────────────────────────────────────────

describe('findPawnMoveSource', () => {
  it('finds white pawn one square back', () => {
    const { board } = parseFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '3', 'w')).toBe('e2')
  })

  it('finds white pawn two squares back (initial advance)', () => {
    const { board } = parseFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '4', 'w')).toBe('e2')
  })

  it('finds black pawn one square back', () => {
    const { board } = parseFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '6', 'b')).toBe('e7')
  })
})

// ── applyMove ─────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('applies e4 from starting position', () => {
    const state = parseFEN(STARTING_FEN)
    const result = applyMove(state, 'e4')
    expect(result).not.toBeNull()
    expect(result!.fromSquare).toBe('e2')
    // e4 should now have a white pawn
    const piece = result!.state.board[squareToCoordRow('e4')]![squareToCoordCol('e4')]
    expect(piece?.type).toBe('P')
    expect(piece?.color).toBe('w')
    // e2 should be empty
    expect(result!.state.board[squareToCoordRow('e2')]![squareToCoordCol('e2')]).toBeNull()
  })

  it('switches active color', () => {
    const state = parseFEN(STARTING_FEN)
    const result = applyMove(state, 'e4')
    expect(result!.state.activeColor).toBe('b')
  })

  it('applies kingside castling', () => {
    // Position after e4 e5 Nf3 Nc6 Bb5 a6 — white can castle O-O
    const fen = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4'
    const state = parseFEN(fen)
    const result = applyMove(state, 'O-O')
    expect(result).not.toBeNull()
    // King should be on g1
    const king = result!.state.board[squareToCoordRow('g1')]![squareToCoordCol('g1')]
    expect(king?.type).toBe('K')
    // Rook should be on f1
    const rook = result!.state.board[squareToCoordRow('f1')]![squareToCoordCol('f1')]
    expect(rook?.type).toBe('R')
    // Castling rights removed
    expect(result!.state.castlingRights.K).toBe(false)
    expect(result!.state.castlingRights.Q).toBe(false)
  })

  it('applies queenside castling', () => {
    const fen = 'r3kbnr/ppp1pppp/2nq4/3p4/3P4/2NQ4/PPP1PPPP/R3KBNR w KQkq - 4 5'
    const state = parseFEN(fen)
    const result = applyMove(state, 'O-O-O')
    expect(result).not.toBeNull()
    const king = result!.state.board[squareToCoordRow('c1')]![squareToCoordCol('c1')]
    expect(king?.type).toBe('K')
    const rook = result!.state.board[squareToCoordRow('d1')]![squareToCoordCol('d1')]
    expect(rook?.type).toBe('R')
  })

  it('records en passant square after two-square pawn advance', () => {
    const state = parseFEN(STARTING_FEN)
    const result = applyMove(state, 'e4')
    expect(result!.state.enPassantSquare).toBe('e3')
  })

  it('captures en passant correctly', () => {
    // White pawn on e5, black pawn plays d5, then exd6 e.p.
    const fen = '8/8/8/4Pp2/8/8/8/4K2k w - f6 0 1'
    const state = parseFEN(fen)
    const result = applyMove(state, 'exf6')
    expect(result).not.toBeNull()
    // Black pawn on f5 should be gone
    expect(result!.state.board[squareToCoordRow('f5')]![squareToCoordCol('f5')]).toBeNull()
    // White pawn should be on f6
    const wp = result!.state.board[squareToCoordRow('f6')]![squareToCoordCol('f6')]
    expect(wp?.type).toBe('P')
    expect(wp?.color).toBe('w')
  })

  it('applies promotion', () => {
    const fen = '8/P7/8/8/8/8/8/4K2k w - - 0 1'
    const state = parseFEN(fen)
    const result = applyMove(state, 'a8=Q')
    expect(result).not.toBeNull()
    const queen = result!.state.board[squareToCoordRow('a8')]![squareToCoordCol('a8')]
    expect(queen?.type).toBe('Q')
    expect(queen?.color).toBe('w')
  })
})

// ── helpers for tests ─────────────────────────────────────────────────────────
function squareToCoordRow(sq: string): number { return 8 - parseInt(sq[1]!, 10) }
function squareToCoordCol(sq: string): number { return sq.charCodeAt(0) - 97 }
