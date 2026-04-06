export type Color = 'w' | 'b'

export type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'

/** Algebraic square notation, e.g. 'e4', 'a1', 'h8' */
export type Square = `${File}${Rank}`

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

/** Structured metadata extracted from PGN annotation commands like [%clk 0:30:00]. */
export type MoveMetadata = Record<string, string>

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
  /** Structured metadata from PGN commands like [%clk], [%eval], etc. */
  metadata?: MoveMetadata
  /** RAV lines that are alternatives to this move, indexed parallel to ParsedMove.variations */
  variations: Transition[][]
}

export type ParsedMove = {
  san: string
  /** Annotation that follows this move in the PGN */
  annotation?: string
  /** RAV lines that start from the position BEFORE this move */
  variations: ParsedMove[][]
}

export type ParsedGame = {
  headers: Record<string, string>
  /** Moves in half-move order, with embedded annotations and variations */
  moves: ParsedMove[]
  /** Annotation that appears before the first move */
  preAnnotation?: string
}

export type ChessViewerOptions = {
  pgn?: string
  /** Starting position as FEN. Defaults to the standard starting position. */
  fen?: string
  /** Base URL for piece SVGs, e.g. '/pieces/mpchess/'. Defaults to '/pieces/mpchess/'. */
  pieceBase?: string
}
