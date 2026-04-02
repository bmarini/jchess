import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseFEN, boardGet, boardSet, squareToCoord, coordToSquare,
  boardToFENRanks, STARTING_FEN, resetPieceIds,
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

describe('parseFEN – starting position', () => {
  it('parses without throwing', () => {
    expect(() => parseFEN(STARTING_FEN)).not.toThrow()
  })

  it('places white king on e1', () => {
    const { board } = parseFEN(STARTING_FEN)
    const piece = boardGet(board, 'e1')
    expect(piece?.type).toBe('K')
    expect(piece?.color).toBe('w')
  })

  it('places black king on e8', () => {
    const { board } = parseFEN(STARTING_FEN)
    const piece = boardGet(board, 'e8')
    expect(piece?.type).toBe('K')
    expect(piece?.color).toBe('b')
  })

  it('e4 is empty', () => {
    const { board } = parseFEN(STARTING_FEN)
    expect(boardGet(board, 'e4')).toBeNull()
  })

  it('active color is white', () => {
    expect(parseFEN(STARTING_FEN).activeColor).toBe('w')
  })

  it('all castling rights available', () => {
    const { castlingRights } = parseFEN(STARTING_FEN)
    expect(castlingRights).toEqual({ K: true, Q: true, k: true, q: true })
  })

  it('no en passant square', () => {
    expect(parseFEN(STARTING_FEN).enPassantSquare).toBeNull()
  })
})

describe('parseFEN – mid-game position', () => {
  const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'

  it('parses active color as black', () => {
    expect(parseFEN(fen).activeColor).toBe('b')
  })

  it('places white knight on f3', () => {
    const { board } = parseFEN(fen)
    const piece = boardGet(board, 'f3')
    expect(piece?.type).toBe('N')
    expect(piece?.color).toBe('w')
  })

  it('places black pawn on c5', () => {
    const { board } = parseFEN(fen)
    const piece = boardGet(board, 'c5')
    expect(piece?.type).toBe('P')
    expect(piece?.color).toBe('b')
  })

  it('e4 has white pawn', () => {
    const { board } = parseFEN(fen)
    const piece = boardGet(board, 'e4')
    expect(piece?.type).toBe('P')
    expect(piece?.color).toBe('w')
  })
})

describe('parseFEN – en passant', () => {
  it('parses en passant square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(parseFEN(fen).enPassantSquare).toBe('e3')
  })
})

describe('parseFEN – partial castling rights', () => {
  it('parses only kingside white', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w K - 0 1'
    const { castlingRights } = parseFEN(fen)
    expect(castlingRights).toEqual({ K: true, Q: false, k: false, q: false })
  })
})

describe('parseFEN – custom position (FEN from demo)', () => {
  it('parses the rq2r1k1 position without throwing', () => {
    expect(() => parseFEN('rq2r1k1/1b3pp1/p3p1n1/1p4BQ/8/7R/PP3PPP/4R1K1 w - - 0 0')).not.toThrow()
  })
})

describe('boardSet', () => {
  it('places a piece without mutating the original', () => {
    const { board } = parseFEN(STARTING_FEN)
    const piece = boardGet(board, 'e2')!
    const next = boardSet(board, 'e4', piece)
    expect(boardGet(next, 'e4')).toBe(piece)
    expect(boardGet(board, 'e4')).toBeNull()  // original unchanged
  })
})

describe('boardToFENRanks', () => {
  it('round-trips the starting position ranks', () => {
    const { board } = parseFEN(STARTING_FEN)
    expect(boardToFENRanks(board)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
  })
})
