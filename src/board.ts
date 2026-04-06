import type { Board, CastlingRights, Color, Piece, PieceType, Square, Vector } from './types.js'

/** Centralized square construction from file + rank strings. */
export function toSquare(file: string, rank: string): Square {
  return `${file}${rank}` as Square
}

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
  return (String.fromCharCode(col + 97) + (8 - row)) as Square
}

export function isOnBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

// ── Board accessors ──────────────────────────────────────────────────────────

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

// ── Piece ID counter ─────────────────────────────────────────────────────────

export type IdCounter = { next: () => number }

export function makeIdCounter(): IdCounter {
  let n = 0
  return { next: () => n++ }
}

// ── Piece vectors ────────────────────────────────────────────────────────────

export const PIECE_VECTORS: Record<PieceType, Vector[]> = {
  R: [
    { x:  0, y:  1, limit: 8 },
    { x:  1, y:  0, limit: 8 },
    { x:  0, y: -1, limit: 8 },
    { x: -1, y:  0, limit: 8 },
  ],
  N: [
    { x:  1, y:  2, limit: 1 },
    { x:  2, y:  1, limit: 1 },
    { x:  2, y: -1, limit: 1 },
    { x:  1, y: -2, limit: 1 },
    { x: -1, y: -2, limit: 1 },
    { x: -2, y: -1, limit: 1 },
    { x: -2, y:  1, limit: 1 },
    { x: -1, y:  2, limit: 1 },
  ],
  B: [
    { x:  1, y:  1, limit: 8 },
    { x:  1, y: -1, limit: 8 },
    { x: -1, y: -1, limit: 8 },
    { x: -1, y:  1, limit: 8 },
  ],
  Q: [
    { x:  0, y:  1, limit: 8 },
    { x:  1, y:  0, limit: 8 },
    { x:  0, y: -1, limit: 8 },
    { x: -1, y:  0, limit: 8 },
    { x:  1, y:  1, limit: 8 },
    { x:  1, y: -1, limit: 8 },
    { x: -1, y: -1, limit: 8 },
    { x: -1, y:  1, limit: 8 },
  ],
  K: [
    { x:  0, y:  1, limit: 1 },
    { x:  1, y:  0, limit: 1 },
    { x:  0, y: -1, limit: 1 },
    { x: -1, y:  0, limit: 1 },
    { x:  1, y:  1, limit: 1 },
    { x:  1, y: -1, limit: 1 },
    { x: -1, y: -1, limit: 1 },
    { x: -1, y:  1, limit: 1 },
  ],
  P: [],
}

// ── Low-level board scanning ─────────────────────────────────────────────────

function stepFromSquare(
  board: Board,
  src: Square,
  vector: Vector,
  steps: number,
): [Piece | null, Square] | null {
  const [row, col] = squareToCoord(src)
  const newRow = row - vector.y * steps
  const newCol = col + vector.x * steps
  if (!isOnBoard(newRow, newCol)) return null
  const sq = coordToSquare(newRow, newCol)
  return [boardGet(board, sq), sq]
}

function firstPieceAlongRay(
  board: Board,
  src: Square,
  vector: Vector,
): [Piece, Square] | null {
  for (let steps = 1; steps <= vector.limit; steps++) {
    const result = stepFromSquare(board, src, vector, steps)
    if (result === null) return null
    const [piece, sq] = result
    if (piece !== null) return [piece, sq]
  }
  return null
}

function flipVector(v: Vector): Vector {
  return { x: -v.x, y: -v.y, limit: v.limit }
}

// ── Pin detection ────────────────────────────────────────────────────────────

function isPinnedToKing(
  board: Board,
  color: Color,
  srcSquare: Square,
  dstSquare: Square,
): boolean {
  const rqVectors = PIECE_VECTORS['R']
  const bqVectors = PIECE_VECTORS['B']

  for (const vectors of [rqVectors, bqVectors]) {
    for (const vec of vectors) {
      const toKing = firstPieceAlongRay(board, srcSquare, vec)
      if (toKing === null) continue
      if (toKing[0].color !== color || toKing[0].type !== 'K') continue

      const kingSq = toKing[1]
      const flipped = flipVector(vec)
      const attacker = firstPieceAlongRay(board, srcSquare, flipped)
      if (attacker === null) continue
      if (attacker[0].color === color) continue

      const attackerType = attacker[0].type
      const isRayRQ = vectors === rqVectors
      const canAttack = isRayRQ
        ? (attackerType === 'R' || attackerType === 'Q')
        : (attackerType === 'B' || attackerType === 'Q')

      if (!canAttack) continue

      const pinnerSq = attacker[1]
      const between = squaresBetween(kingSq, pinnerSq)
      if (between.includes(dstSquare)) return false
      return true
    }
  }
  return false
}

function squaresBetween(a: Square, b: Square): Square[] {
  const [r1, c1] = squareToCoord(a)
  const [r2, c2] = squareToCoord(b)
  const squares: Square[] = [a]
  let r = r1, c = c1
  while (r !== r2 || c !== c2) {
    if (r < r2) r++; else if (r > r2) r--
    if (c < c2) c++; else if (c > c2) c--
    squares.push(coordToSquare(r, c))
  }
  return squares
}

// ── Source-finding ────────────────────────────────────────────────────────────

export function findMoveSource(
  board: Board,
  pieceType: PieceType,
  color: Color,
  dstSquare: Square,
  hintFile?: string,
  hintRank?: string,
): Square | null {
  if (hintFile && hintRank) return toSquare(hintFile, hintRank)

  const vectors = PIECE_VECTORS[pieceType]

  for (const vec of vectors) {
    for (let steps = 1; steps <= vec.limit; steps++) {
      const result = stepFromSquare(board, dstSquare, vec, steps)
      if (result === null) break

      const [piece, candidateSq] = result
      if (piece === null) continue

      if (piece.color !== color || piece.type !== pieceType) {
        break
      }

      if (hintFile && candidateSq[0] !== hintFile) break
      if (hintRank && candidateSq[1] !== hintRank) break

      if (isPinnedToKing(board, color, candidateSq, dstSquare)) break

      return candidateSq
    }
  }

  return null
}

export function findPawnMoveSource(
  board: Board,
  dstFile: string,
  dstRank: string,
  color: Color,
): Square | null {
  const dstSquare = toSquare(dstFile, dstRank)
  const direction = color === 'w' ? -1 : 1
  const vector: Vector = { x: 0, y: direction, limit: 2 }

  for (let steps = 1; steps <= vector.limit; steps++) {
    const result = stepFromSquare(board, dstSquare, vector, steps)
    if (result === null) break
    const [piece, candidateSq] = result
    if (piece !== null) {
      if (piece.color === color && piece.type === 'P') return candidateSq
      break
    }
  }

  return null
}

// ── SAN parsing ──────────────────────────────────────────────────────────────

export type ParsedSAN =
  | { kind: 'castle'; side: 'K' | 'Q' }
  | {
      kind: 'normal'
      pieceType: PieceType
      dstSquare: Square
      hintFile?: string
      hintRank?: string
      capture: boolean
      promotion?: PieceType
      check: boolean
      checkmate: boolean
    }

const SAN_NORMAL = /^([NBRQK])?([a-h])?([1-8])?(x)?([a-h])([1-8])(=[NBRQ])?([+#])?/

export function parseSAN(san: string): ParsedSAN | null {
  if (/^O-O-O/.test(san)) return { kind: 'castle', side: 'Q' }
  if (/^O-O/.test(san))   return { kind: 'castle', side: 'K' }

  const m = SAN_NORMAL.exec(san)
  if (!m) return null

  const [, piece, hintFile, hintRank, captureX, dstFile, dstRank, promoStr, checkStr] = m
  if (!dstFile || !dstRank) return null

  const pieceType: PieceType = (piece as PieceType | undefined) ?? 'P'
  const dstSquare: Square = toSquare(dstFile, dstRank)
  const capture = captureX === 'x'
  const promotion = promoStr ? (promoStr[1] as PieceType) : undefined
  const check = checkStr === '+' || san.includes('+')
  const checkmate = checkStr === '#' || san.includes('#')

  return { kind: 'normal', pieceType, dstSquare, hintFile, hintRank, capture, promotion, check, checkmate }
}

// ── Move application result ──────────────────────────────────────────────────

export type MoveApplication = {
  position: Position
  captured: Piece | null
  fromSquare: Square
  parsed: ParsedSAN
}

// ── Position ─────────────────────────────────────────────────────────────────

export class Position {
  constructor(
    readonly board: Board,
    readonly activeColor: Color,
    readonly castlingRights: CastlingRights,
    readonly enPassantSquare: Square | null,
    readonly halfmoveClock: number,
    readonly fullmoveNumber: number,
  ) {}

  static fromFEN(fen: string, ids: IdCounter = makeIdCounter()): Position {
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
          board[row]![col] = { color, type, id: ids.next() }
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
    const enPassantSquare: Square | null = epStr === '-' ? null : epStr as Square

    const halfmoveClock = parseInt(parts[4] ?? '0', 10)
    const fullmoveNumber = parseInt(parts[5] ?? '1', 10)

    return new Position(board, activeColor, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber)
  }

  static starting(ids?: IdCounter): Position {
    return Position.fromFEN(STARTING_FEN, ids)
  }

  /** Get the piece on a square, or null if empty. */
  get(sq: Square): Piece | null {
    return boardGet(this.board, sq)
  }

  /** Check if the side to move's king is attacked. */
  isInCheck(): boolean {
    const color = this.activeColor
    const opponent = color === 'w' ? 'b' : 'w'

    // Find the king
    let kingSq: Square | null = null
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row]?.[col]
        if (piece && piece.type === 'K' && piece.color === color) {
          kingSq = coordToSquare(row, col)
          break
        }
      }
      if (kingSq) break
    }
    if (!kingSq) return false

    // Check attacks using raw piece vectors (no legalMovesFrom to avoid circular calls)
    const [kRow, kCol] = squareToCoord(kingSq)

    // Check sliding pieces (R, B, Q) and knight/king
    for (const pieceType of ['R', 'B', 'Q', 'N', 'K'] as PieceType[]) {
      for (const vec of PIECE_VECTORS[pieceType]) {
        for (let steps = 1; steps <= vec.limit; steps++) {
          const nr = kRow - vec.y * steps
          const nc = kCol + vec.x * steps
          if (!isOnBoard(nr, nc)) break
          const piece = this.board[nr]?.[nc]
          if (!piece) continue
          if (piece.color === opponent && piece.type === pieceType) return true
          break // blocked
        }
      }
    }

    // Check pawn attacks
    const pawnDir = color === 'w' ? -1 : 1 // pawns attack from this direction
    for (const dc of [-1, 1]) {
      const pr = kRow + pawnDir
      const pc = kCol + dc
      if (!isOnBoard(pr, pc)) continue
      const piece = this.board[pr]?.[pc]
      if (piece && piece.color === opponent && piece.type === 'P') return true
    }

    return false
  }

  /**
   * Try a move by coordinates. Returns a new Position if legal (own king not
   * left in check), null otherwise. Does not handle castling — caller uses
   * applyMove('O-O') for that. Fast path for legality checking.
   */
  applyMoveCoords(
    fromRow: number, fromCol: number,
    toRow: number, toCol: number,
    promotion?: PieceType,
  ): Position | null {
    const movingPiece = this.board[fromRow]?.[fromCol]
    if (!movingPiece) return null

    const color = movingPiece.color
    const captured = this.board[toRow]?.[toCol] ?? null

    const newBoard = this.board.map(r => r.slice()) as Board

    newBoard[fromRow]![fromCol] = null

    // En passant capture
    if (movingPiece.type === 'P' && fromCol !== toCol && !captured) {
      newBoard[fromRow]![toCol] = null
    }

    newBoard[toRow]![toCol] = promotion
      ? { color, type: promotion, id: movingPiece.id }
      : movingPiece

    // Check if own king is left in check after the move
    const checkPos = new Position(
      newBoard, color, this.castlingRights, null, 0, this.fullmoveNumber,
    )
    if (checkPos.isInCheck()) return null

    return new Position(
      newBoard,
      color === 'w' ? 'b' : 'w',
      this.castlingRights,
      null,
      0,
      this.fullmoveNumber,
    )
  }

  /** Serialize back to FEN notation. */
  toFEN(): string {
    const { K, Q, k, q } = this.castlingRights
    const castleStr = [K ? 'K' : '', Q ? 'Q' : '', k ? 'k' : '', q ? 'q' : ''].join('') || '-'
    const ep = this.enPassantSquare ?? '-'
    return `${boardToFENRanks(this.board)} ${this.activeColor} ${castleStr} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`
  }

  /** Apply a SAN move and return the new position + metadata, or null if illegal. */
  applyMove(san: string): MoveApplication | null {
    const parsed = parseSAN(san)
    if (!parsed) return null

    const { board, activeColor } = this
    const color = activeColor

    if (parsed.kind === 'castle') {
      return { ...this._applyCastle(parsed.side), parsed }
    }

    const { pieceType, dstSquare, hintFile, hintRank, promotion } = parsed

    let fromSquare: Square | null

    if (pieceType === 'P') {
      if (parsed.capture) {
        // hintFile is always present for pawn captures in well-formed SAN (e.g. 'exd5')
        fromSquare = toSquare(hintFile ?? '', color === 'w'
          ? String(parseInt(dstSquare[1]!, 10) - 1)
          : String(parseInt(dstSquare[1]!, 10) + 1))
      } else {
        fromSquare = findPawnMoveSource(board, dstSquare[0]!, dstSquare[1]!, color)
      }
    } else {
      fromSquare = findMoveSource(board, pieceType, color, dstSquare, hintFile, hintRank)
    }

    if (!fromSquare) return null

    let captured: Piece | null = boardGet(board, dstSquare)
    let epCaptureSquare: Square | null = null

    if (pieceType === 'P' && parsed.capture && captured === null) {
      epCaptureSquare = toSquare(dstSquare[0]!, fromSquare[1]!)
      captured = boardGet(board, epCaptureSquare)
    }

    const newBoard = board.map(row => row.slice()) as typeof board

    const [fromRow, fromCol] = squareToCoord(fromSquare)
    const [dstRow, dstCol] = squareToCoord(dstSquare)

    const movingPiece = newBoard[fromRow]![fromCol]!
    newBoard[fromRow]![fromCol] = null
    if (epCaptureSquare) {
      const [epRow, epCol] = squareToCoord(epCaptureSquare)
      newBoard[epRow]![epCol] = null
    }
    newBoard[dstRow]![dstCol] = promotion
      ? { ...movingPiece, type: promotion }
      : movingPiece

    const cr: CastlingRights = { ...this.castlingRights }
    if (pieceType === 'K') {
      if (color === 'w') { cr.K = false; cr.Q = false }
      else               { cr.k = false; cr.q = false }
    }
    if (fromSquare === 'a1' || dstSquare === 'a1') cr.Q = false
    if (fromSquare === 'h1' || dstSquare === 'h1') cr.K = false
    if (fromSquare === 'a8' || dstSquare === 'a8') cr.q = false
    if (fromSquare === 'h8' || dstSquare === 'h8') cr.k = false

    let newEP: Square | null = null
    if (pieceType === 'P') {
      const fromRank = parseInt(fromSquare[1]!, 10)
      const toRank = parseInt(dstSquare[1]!, 10)
      if (Math.abs(toRank - fromRank) === 2) {
        newEP = toSquare(dstSquare[0]!, String(Math.floor((fromRank + toRank) / 2)))
      }
    }

    return {
      position: new Position(
        newBoard,
        color === 'w' ? 'b' : 'w',
        cr,
        newEP,
        (pieceType === 'P' || captured !== null) ? 0 : this.halfmoveClock + 1,
        color === 'b' ? this.fullmoveNumber + 1 : this.fullmoveNumber,
      ),
      captured,
      fromSquare,
      parsed,
    }
  }


  private _applyCastle(side: 'K' | 'Q'): Omit<MoveApplication, 'parsed'> {
    const color = this.activeColor
    const rank = color === 'w' ? '1' : '8'

    const kingFrom: Square = toSquare('e', rank)
    const kingTo:   Square = side === 'K' ? toSquare('g', rank) : toSquare('c', rank)
    const rookFrom: Square = side === 'K' ? toSquare('h', rank) : toSquare('a', rank)
    const rookTo:   Square = side === 'K' ? toSquare('f', rank) : toSquare('d', rank)

    const newBoard = this.board.map(row => row.slice()) as typeof this.board

    const [kingFromRow, kingFromCol] = squareToCoord(kingFrom)
    const [rookFromRow, rookFromCol] = squareToCoord(rookFrom)
    const [kingToRow, kingToCol] = squareToCoord(kingTo)
    const [rookToRow, rookToCol] = squareToCoord(rookTo)

    const king = newBoard[kingFromRow]![kingFromCol]!
    const rook = newBoard[rookFromRow]![rookFromCol]!

    newBoard[kingFromRow]![kingFromCol] = null
    newBoard[rookFromRow]![rookFromCol] = null
    newBoard[kingToRow]![kingToCol] = king
    newBoard[rookToRow]![rookToCol] = rook

    const cr: CastlingRights = { ...this.castlingRights }
    if (color === 'w') { cr.K = false; cr.Q = false }
    else               { cr.k = false; cr.q = false }

    return {
      position: new Position(
        newBoard,
        color === 'w' ? 'b' : 'w',
        cr,
        null,
        this.halfmoveClock + 1,
        color === 'b' ? this.fullmoveNumber + 1 : this.fullmoveNumber,
      ),
      captured: null,
      fromSquare: kingFrom,
    }
  }
}
