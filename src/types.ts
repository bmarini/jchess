export type Color = 'w' | 'b'

export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'

/** Algebraic square notation, e.g. 'e4', 'a1', 'h8' */
export type Square = string

export type Piece = {
  color: Color
  type: PieceType
  /** Stable numeric ID used to track DOM elements across moves */
  id: number
}

/**
 * 8×8 board. board[0] is rank 8 (black's back rank), board[7] is rank 1.
 * board[row][col], col 0 = a-file, col 7 = h-file.
 */
export type Board = (Piece | null)[][]

export type CastlingRights = {
  K: boolean  // white kingside
  Q: boolean  // white queenside
  k: boolean  // black kingside
  q: boolean  // black queenside
}

/** A directional step vector for piece movement */
export type Vector = {
  x: number  // file delta per step (+1 = toward h-file)
  y: number  // rank delta per step (+1 = toward rank 8)
  limit: number
}

export type TransitionCommand =
  | { op: 'move'; pieceId: number; from: Square; to: Square }
  | { op: 'remove'; pieceId: number; piece: Piece; square: Square }
  | { op: 'add'; pieceId: number; piece: Piece; square: Square }

export type Transition = {
  forward: TransitionCommand[]
  backward: TransitionCommand[]
  /** SAN notation for the move, e.g. 'Nf3', 'O-O', 'exd5' */
  san: string
  annotation?: string
}

export type ParsedGame = {
  headers: Record<string, string>
  /** SAN strings in half-move order */
  moves: string[]
  /** Indexed by half-move number (0-based). Undefined means no annotation. */
  annotations: (string | undefined)[]
}

export type ChessViewerOptions = {
  pgn?: string
  /** Starting position as FEN. Defaults to the standard starting position. */
  fen?: string
}
