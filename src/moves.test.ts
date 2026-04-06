import { describe, it, expect } from 'vitest'
import { Position, STARTING_FEN, findMoveSource, findPawnMoveSource, parseSAN } from './board.js'

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
    const { board } = Position.fromFEN(STARTING_FEN)
    expect(findMoveSource(board, 'N', 'w', 'f3')).toBe('g1')
  })

  it('finds the only knight that can reach c3', () => {
    const { board } = Position.fromFEN(STARTING_FEN)
    expect(findMoveSource(board, 'N', 'w', 'c3')).toBe('b1')
  })

  it('disambiguates by file when two knights can reach the same square', () => {
    const { board } = Position.fromFEN('8/8/8/2N1N3/8/8/8/4K2k w - - 0 1')
    expect(findMoveSource(board, 'N', 'w', 'd3', 'c')).toBe('c5')
    expect(findMoveSource(board, 'N', 'w', 'd3', 'e')).toBe('e5')
  })
})

describe('findMoveSource – rooks', () => {
  it('finds rook on open file', () => {
    const { board } = Position.fromFEN('8/8/8/8/R7/8/8/4K2k w - - 0 1')
    expect(findMoveSource(board, 'R', 'w', 'a8')).toBe('a4')
  })

  it('disambiguates two rooks by file', () => {
    const { board } = Position.fromFEN('8/8/8/8/R3R3/8/8/4K2k w - - 0 1')
    expect(findMoveSource(board, 'R', 'w', 'd4', 'a')).toBe('a4')
    expect(findMoveSource(board, 'R', 'w', 'd4', 'e')).toBe('e4')
  })

  it('disambiguates two rooks by rank', () => {
    const { board } = Position.fromFEN('R7/8/8/8/8/8/8/R3K2k w - - 0 1')
    expect(findMoveSource(board, 'R', 'w', 'a5', undefined, '1')).toBe('a1')
    expect(findMoveSource(board, 'R', 'w', 'a5', undefined, '8')).toBe('a8')
  })
})

// ── findPawnMoveSource ────────────────────────────────────────────────────────

describe('findPawnMoveSource', () => {
  it('finds white pawn one square back', () => {
    const { board } = Position.fromFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '3', 'w')).toBe('e2')
  })

  it('finds white pawn two squares back (initial advance)', () => {
    const { board } = Position.fromFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '4', 'w')).toBe('e2')
  })

  it('finds black pawn one square back', () => {
    const { board } = Position.fromFEN(STARTING_FEN)
    expect(findPawnMoveSource(board, 'e', '6', 'b')).toBe('e7')
  })
})

// ── Position.applyMove ───────────────────────────────────────────────────────

describe('Position.applyMove', () => {
  it('applies e4 from starting position', () => {
    const pos = Position.fromFEN(STARTING_FEN)
    const result = pos.applyMove('e4')
    expect(result).not.toBeNull()
    expect(result!.fromSquare).toBe('e2')
    expect(result!.position.get('e4')).toMatchObject({ type: 'P', color: 'w' })
    expect(result!.position.get('e2')).toBeNull()
  })

  it('switches active color', () => {
    expect(Position.fromFEN(STARTING_FEN).applyMove('e4')!.position.activeColor).toBe('b')
  })

  it('applies kingside castling', () => {
    const pos = Position.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')
    const result = pos.applyMove('O-O')
    expect(result).not.toBeNull()
    expect(result!.position.get('g1')).toMatchObject({ type: 'K' })
    expect(result!.position.get('f1')).toMatchObject({ type: 'R' })
    expect(result!.position.castlingRights.K).toBe(false)
    expect(result!.position.castlingRights.Q).toBe(false)
  })

  it('applies queenside castling', () => {
    const pos = Position.fromFEN('r3kbnr/ppp1pppp/2nq4/3p4/3P4/2NQ4/PPP1PPPP/R3KBNR w KQkq - 4 5')
    const result = pos.applyMove('O-O-O')
    expect(result).not.toBeNull()
    expect(result!.position.get('c1')).toMatchObject({ type: 'K' })
    expect(result!.position.get('d1')).toMatchObject({ type: 'R' })
  })

  it('records en passant square after two-square pawn advance', () => {
    expect(Position.fromFEN(STARTING_FEN).applyMove('e4')!.position.enPassantSquare).toBe('e3')
  })

  it('captures en passant correctly', () => {
    const pos = Position.fromFEN('8/8/8/4Pp2/8/8/8/4K2k w - f6 0 1')
    const result = pos.applyMove('exf6')
    expect(result).not.toBeNull()
    expect(result!.position.get('f5')).toBeNull()
    expect(result!.position.get('f6')).toMatchObject({ type: 'P', color: 'w' })
  })

  it('applies promotion', () => {
    const pos = Position.fromFEN('8/P7/8/8/8/8/8/4K2k w - - 0 1')
    const result = pos.applyMove('a8=Q')
    expect(result).not.toBeNull()
    expect(result!.position.get('a8')).toMatchObject({ type: 'Q', color: 'w' })
  })
})

// ── Position.toSAN ───────────────────────────────────────────────────────────

describe('Position.toSAN', () => {
  it('converts a pawn push', () => {
    expect(Position.starting().toSAN('e2', 'e4')).toBe('e4')
  })

  it('converts a pawn capture', () => {
    const pos = Position.starting().applyMove('e4')!.position.applyMove('d5')!.position
    expect(pos.toSAN('e4', 'd5')).toBe('exd5')
  })

  it('converts a knight move', () => {
    expect(Position.starting().toSAN('g1', 'f3')).toBe('Nf3')
  })

  it('adds file disambiguation for knights', () => {
    const pos = Position.fromFEN('8/8/8/8/3N4/8/8/4K1N1 w - - 0 1')
    expect(pos.toSAN('d4', 'f3')).toBe('Ndf3')
  })

  it('converts kingside castling', () => {
    const pos = Position.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')
    expect(pos.toSAN('e1', 'g1')).toBe('O-O')
  })

  it('converts queenside castling', () => {
    const pos = Position.fromFEN('r3k2r/pppq1ppp/2n1bn2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b kq - 0 7')
    expect(pos.toSAN('e8', 'c8')).toBe('O-O-O')
  })

  it('converts promotion', () => {
    const pos = Position.fromFEN('8/P7/8/8/8/8/8/4K2k w - - 0 1')
    expect(pos.toSAN('a7', 'a8', 'Q')).toBe('a8=Q+')
  })

  it('returns null for illegal moves', () => {
    expect(Position.starting().toSAN('e2', 'e5')).toBeNull()
  })

  it('returns null for wrong color', () => {
    expect(Position.starting().toSAN('e7', 'e5')).toBeNull()
  })
})
