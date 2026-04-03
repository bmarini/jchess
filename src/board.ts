import type { Board, CastlingRights, Color, Piece, PieceType, Square } from './types.js'

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ── Coordinate helpers ────────────────────────────────────────────────────────

/** 'e4' → [row, col]. Row 0 = rank 8, row 7 = rank 1. */
export function squareToCoord(sq: Square): [number, number] {
  const col = sq.charCodeAt(0) - 97  // 'a' = 0
  const row = 8 - parseInt(sq[1]!, 10)
  return [row, col]
}

/** [row, col] → 'e4' */
export function coordToSquare(row: number, col: number): Square {
  return String.fromCharCode(col + 97) + (8 - row)
}

export function isOnBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

// ── Board accessors (used internally and in moves.ts) ─────────────────────────

export function boardGet(board: Board, sq: Square): Piece | null {
  const [row, col] = squareToCoord(sq)
  return board[row]?.[col] ?? null
}

export function boardSet(board: Board, sq: Square, piece: Piece | null): Board {
  const next = board.map(row => row.slice())
  const [row, col] = squareToCoord(sq)
  next[row]![col] = piece
  return next
}

export function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null) as (Piece | null)[])
}

export function boardToFENRanks(board: Board): string {
  return board.map(row => {
    let s = ''
    let empty = 0
    for (const piece of row) {
      if (piece === null) {
        empty++
      } else {
        if (empty) { s += empty; empty = 0 }
        s += piece.color === 'w' ? piece.type : piece.type.toLowerCase()
      }
    }
    if (empty) s += empty
    return s
  }).join('/')
}

// ── Piece ID counter ──────────────────────────────────────────────────────────
// Still a global for now; will be refactored in a follow-up commit.

let nextId = 0

/** Reset the piece-ID counter. Required in tests and before building a game. */
export function resetPieceIds(): void { nextId = 0 }

export function allocatePieceId(): number { return nextId++ }

// ── Position ──────────────────────────────────────────────────────────────────

/**
 * Immutable snapshot of a chess position.
 * Use `Position.fromFEN` or `Position.starting()` to construct.
 * Apply a move with `applyMove(position, san)` from moves.ts.
 */
export class Position {
  constructor(
    readonly board: Board,
    readonly activeColor: Color,
    readonly castlingRights: CastlingRights,
    readonly enPassantSquare: Square | null,
    readonly halfmoveClock: number,
    readonly fullmoveNumber: number,
  ) {}

  static fromFEN(fen: string): Position {
    const parts = fen.trim().split(/\s+/)

    const rankStrings = parts[0]!.split('/')
    if (rankStrings.length !== 8) {
      throw new Error(`Invalid FEN: expected 8 ranks, got ${rankStrings.length}`)
    }

    const board: Board = emptyBoard()
    for (let row = 0; row < 8; row++) {
      let col = 0
      for (const ch of rankStrings[row]!) {
        if (col >= 8) throw new Error(`Invalid FEN rank ${row + 1}: too many squares`)
        if (ch >= '1' && ch <= '8') {
          col += parseInt(ch, 10)
        } else {
          const color: Color = ch === ch.toUpperCase() ? 'w' : 'b'
          const type = ch.toUpperCase() as PieceType
          board[row]![col] = { color, type, id: allocatePieceId() }
          col++
        }
      }
      if (col !== 8) throw new Error(`Invalid FEN rank ${row + 1}: expected 8 squares`)
    }

    const activeColor: Color = parts[1] === 'b' ? 'b' : 'w'

    const castleStr = parts[2] ?? '-'
    const castlingRights: CastlingRights = {
      K: castleStr.includes('K'),
      Q: castleStr.includes('Q'),
      k: castleStr.includes('k'),
      q: castleStr.includes('q'),
    }

    const epStr = parts[3] ?? '-'
    const enPassantSquare: Square | null = epStr === '-' ? null : epStr

    const halfmoveClock = parseInt(parts[4] ?? '0', 10)
    const fullmoveNumber = parseInt(parts[5] ?? '1', 10)

    return new Position(board, activeColor, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber)
  }

  static starting(): Position {
    return Position.fromFEN(STARTING_FEN)
  }

  /** Get the piece on a square, or null if empty. */
  get(sq: Square): Piece | null {
    return boardGet(this.board, sq)
  }

  /** Serialize back to FEN notation. */
  toFEN(): string {
    const { K, Q, k, q } = this.castlingRights
    const castleStr = [K ? 'K' : '', Q ? 'Q' : '', k ? 'k' : '', q ? 'q' : ''].join('') || '-'
    const ep = this.enPassantSquare ?? '-'
    return `${boardToFENRanks(this.board)} ${this.activeColor} ${castleStr} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`
  }
}
