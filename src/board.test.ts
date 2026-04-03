import { describe, it, expect, beforeEach } from 'vitest'
import {
  Position, boardGet, boardSet, boardToFENRanks,
  squareToCoord, coordToSquare, STARTING_FEN, resetPieceIds,
} from './board.js'

beforeEach(() => resetPieceIds())

describe('squareToCoord / coordToSquare', () => {
  it('a1 is bottom-left (row 7, col 0)', () => {
    expect(squareToCoord('a1')).toEqual([7, 0])
  })
  it('h8 is top-right (row 0, col 7)', () => {
    expect(squareToCoord('h8')).toEqual([0, 7])
  })
  it('e4 maps correctly', () => {
    expect(squareToCoord('e4')).toEqual([4, 4])
  })
  it('round-trips all squares', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = coordToSquare(row, col)
        expect(squareToCoord(sq)).toEqual([row, col])
      }
    }
  })
})

describe('Position.fromFEN – starting position', () => {
  it('parses without throwing', () => {
    expect(() => Position.fromFEN(STARTING_FEN)).not.toThrow()
  })

  it('places white king on e1', () => {
    expect(Position.fromFEN(STARTING_FEN).get('e1')).toMatchObject({ type: 'K', color: 'w' })
  })

  it('places black king on e8', () => {
    expect(Position.fromFEN(STARTING_FEN).get('e8')).toMatchObject({ type: 'K', color: 'b' })
  })

  it('e4 is empty', () => {
    expect(Position.fromFEN(STARTING_FEN).get('e4')).toBeNull()
  })

  it('active color is white', () => {
    expect(Position.fromFEN(STARTING_FEN).activeColor).toBe('w')
  })

  it('all castling rights available', () => {
    expect(Position.fromFEN(STARTING_FEN).castlingRights).toEqual({ K: true, Q: true, k: true, q: true })
  })

  it('no en passant square', () => {
    expect(Position.fromFEN(STARTING_FEN).enPassantSquare).toBeNull()
  })
})

describe('Position.starting()', () => {
  it('is equivalent to fromFEN(STARTING_FEN)', () => {
    const a = Position.fromFEN(STARTING_FEN)
    resetPieceIds()
    const b = Position.starting()
    expect(boardToFENRanks(a.board)).toBe(boardToFENRanks(b.board))
    expect(a.activeColor).toBe(b.activeColor)
    expect(a.castlingRights).toEqual(b.castlingRights)
  })
})

describe('Position.fromFEN – mid-game position', () => {
  const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'

  it('parses active color as black', () => {
    expect(Position.fromFEN(fen).activeColor).toBe('b')
  })

  it('places white knight on f3', () => {
    expect(Position.fromFEN(fen).get('f3')).toMatchObject({ type: 'N', color: 'w' })
  })

  it('places black pawn on c5', () => {
    expect(Position.fromFEN(fen).get('c5')).toMatchObject({ type: 'P', color: 'b' })
  })

  it('e4 has white pawn', () => {
    expect(Position.fromFEN(fen).get('e4')).toMatchObject({ type: 'P', color: 'w' })
  })
})

describe('Position.fromFEN – en passant', () => {
  it('parses en passant square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(Position.fromFEN(fen).enPassantSquare).toBe('e3')
  })
})

describe('Position.fromFEN – partial castling rights', () => {
  it('parses only kingside white', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w K - 0 1'
    expect(Position.fromFEN(fen).castlingRights).toEqual({ K: true, Q: false, k: false, q: false })
  })
})

describe('Position.fromFEN – custom position', () => {
  it('parses the rq2r1k1 position without throwing', () => {
    expect(() => Position.fromFEN('rq2r1k1/1b3pp1/p3p1n1/1p4BQ/8/7R/PP3PPP/4R1K1 w - - 0 0')).not.toThrow()
  })
})

describe('Position.toFEN()', () => {
  it('round-trips the starting position', () => {
    expect(Position.fromFEN(STARTING_FEN).toFEN()).toBe(STARTING_FEN)
  })

  it('round-trips a mid-game position', () => {
    const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    expect(Position.fromFEN(fen).toFEN()).toBe(fen)
  })
})

describe('boardSet', () => {
  it('places a piece without mutating the original board', () => {
    const pos = Position.fromFEN(STARTING_FEN)
    const piece = pos.get('e2')!
    const next = boardSet(pos.board, 'e4', piece)
    expect(boardGet(next, 'e4')).toBe(piece)
    expect(pos.get('e4')).toBeNull()  // original position unchanged
  })
})

describe('boardToFENRanks', () => {
  it('round-trips the starting position ranks', () => {
    expect(boardToFENRanks(Position.fromFEN(STARTING_FEN).board))
      .toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
  })
})
