import { boardGet, coordToSquare, isOnBoard, Position, squareToCoord } from './board.js'
import type { Board, CastlingRights, Color, Piece, PieceType, Square, Vector } from './types.js'

// ── Piece vectors ─────────────────────────────────────────────────────────────

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
  // Pawns are handled specially
  P: [],
}

// ── Low-level board scanning ──────────────────────────────────────────────────

/**
 * From `src`, travel `steps` steps along `vector`.
 * Returns [piece | null, square] or null if the destination is off the board.
 * The board coordinate system: row increases toward rank 1, so y:+1 means toward rank 8.
 */
function stepFromSquare(
  board: Board,
  src: Square,
  vector: Vector,
  steps: number,
): [Piece | null, Square] | null {
  const [row, col] = squareToCoord(src)
  // vector.y is in rank direction (+1 = toward rank 8 = lower row index)
  const newRow = row - vector.y * steps
  const newCol = col + vector.x * steps
  if (!isOnBoard(newRow, newCol)) return null
  const sq = coordToSquare(newRow, newCol)
  return [boardGet(board, sq), sq]
}

/**
 * Walk vector from src until a piece is hit or the board edge is reached.
 * Returns the first piece found and its square, or null if the ray is empty.
 */
function firstPieceAlongRay(
  board: Board,
  src: Square,
  vector: Vector,
): [Piece, Square] | null {
  for (let steps = 1; steps <= vector.limit; steps++) {
    const result = stepFromSquare(board, src, vector, steps)
    if (result === null) return null       // off board
    const [piece, sq] = result
    if (piece !== null) return [piece, sq] // hit something
  }
  return null
}

function flipVector(v: Vector): Vector {
  return { x: -v.x, y: -v.y, limit: v.limit }
}

// ── Pin detection ─────────────────────────────────────────────────────────────

/**
 * Returns true if moving the piece on `srcSquare` to `dstSquare` would expose
 * the player's king to check (absolute pin).
 */
function isPinnedToKing(
  board: Board,
  color: Color,
  srcSquare: Square,
  dstSquare: Square,
): boolean {
  const kingType: PieceType = 'K'
  const rqVectors = PIECE_VECTORS['R']
  const bqVectors = PIECE_VECTORS['B']

  for (const vectors of [rqVectors, bqVectors]) {
    for (const vec of vectors) {
      // Look for the king along this vector from srcSquare
      const toKing = firstPieceAlongRay(board, srcSquare, vec)
      if (toKing === null) continue
      if (toKing[0].color !== color || toKing[0].type !== kingType) continue

      const kingSq = toKing[1]

      // Look for an attacking piece in the opposite direction
      const flipped = flipVector(vec)
      const attacker = firstPieceAlongRay(board, srcSquare, flipped)
      if (attacker === null) continue
      if (attacker[0].color === color) continue

      // Is the attacker a slider that covers this ray type?
      const attackerType = attacker[0].type
      const isRayRQ = vectors === rqVectors
      const canAttack = isRayRQ
        ? (attackerType === 'R' || attackerType === 'Q')
        : (attackerType === 'B' || attackerType === 'Q')

      if (!canAttack) continue

      // The piece is pinned. It can still move if dstSquare is between king and attacker.
      const pinnerSq = attacker[1]
      const between = squaresBetween(kingSq, pinnerSq)
      if (between.includes(dstSquare)) return false  // moving along the pin ray is fine
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
    if (r < r2) r++
    else if (r > r2) r--
    if (c < c2) c++
    else if (c > c2) c--
    squares.push(coordToSquare(r, c))
  }
  return squares
}

// ── Source-finding ────────────────────────────────────────────────────────────

/**
 * Find the source square for a piece move described in SAN.
 * Searches by casting rays backward from the destination.
 *
 * @param board  Current board state
 * @param pieceType  E.g. 'N', 'B', 'R', 'Q', 'K'
 * @param color  Which player is moving
 * @param dstSquare  Destination square from SAN
 * @param hintFile  Disambiguation file hint (e.g. 'e' in 'Nef3')
 * @param hintRank  Disambiguation rank hint (e.g. '2' in 'N2f3')
 * @returns  Source square, or null if not found
 */
export function findMoveSource(
  board: Board,
  pieceType: PieceType,
  color: Color,
  dstSquare: Square,
  hintFile?: string,
  hintRank?: string,
): Square | null {
  if (hintFile && hintRank) return hintFile + hintRank  // fully specified

  const vectors = PIECE_VECTORS[pieceType]

  for (const vec of vectors) {
    for (let steps = 1; steps <= vec.limit; steps++) {
      const result = stepFromSquare(board, dstSquare, vec, steps)
      if (result === null) break  // off board

      const [piece, candidateSq] = result
      if (piece === null) continue  // empty square, keep going along ray

      if (piece.color !== color || piece.type !== pieceType) {
        break  // blocked by wrong piece — can't see further along this ray
      }

      // Correct piece found — check disambiguation hints
      if (hintFile && candidateSq[0] !== hintFile) break
      if (hintRank && candidateSq[1] !== hintRank) break

      // Check for absolute pin
      if (isPinnedToKing(board, color, candidateSq, dstSquare)) break

      return candidateSq
    }
  }

  return null
}

/**
 * Find the source square for a pawn move (non-capture).
 * Walks backward along the pawn's direction of movement.
 */
export function findPawnMoveSource(
  board: Board,
  dstFile: string,
  dstRank: string,
  color: Color,
): Square | null {
  const dstSquare = dstFile + dstRank
  // Pawns move forward: white goes from rank 1→8 (row decreases), black from rank 8→1 (row increases)
  // Searching backward: white pawn came from lower rank (higher row), so vector.y = -1
  const direction = color === 'w' ? -1 : 1
  const vector: Vector = { x: 0, y: direction, limit: 2 }

  for (let steps = 1; steps <= vector.limit; steps++) {
    const result = stepFromSquare(board, dstSquare, vector, steps)
    if (result === null) break
    const [piece, candidateSq] = result
    if (piece !== null) {
      if (piece.color === color && piece.type === 'P') return candidateSq
      break  // blocked
    }
    // Empty square — can only reach via 2-square advance if the pawn hasn't moved
    // (i.e. it's still on its starting rank). We continue the loop to check 2 squares.
  }

  return null
}

// ── SAN parsing ──────────────────────────────────────────────────────────────

export type ParsedMove =
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

// One pattern covers all normal SAN moves.
// Groups: piece? hint-file? hint-rank? capture? dst-file dst-rank promotion? check?
const SAN_NORMAL = /^([NBRQK])?([a-h])?([1-8])?(x)?([a-h])([1-8])(=[NBRQ])?([+#])?/

/**
 * Parse a SAN string into a structured move description.
 */
export function parseSAN(san: string): ParsedMove | null {
  if (/^O-O-O/.test(san)) return { kind: 'castle', side: 'Q' }
  if (/^O-O/.test(san))   return { kind: 'castle', side: 'K' }

  const m = SAN_NORMAL.exec(san)
  if (!m) return null

  const [, piece, hintFile, hintRank, captureX, dstFile, dstRank, promoStr, checkStr] = m
  if (!dstFile || !dstRank) return null

  const pieceType: PieceType = (piece as PieceType | undefined) ?? 'P'
  const dstSquare: Square = dstFile + dstRank
  const capture = captureX === 'x'
  const promotion = promoStr ? (promoStr[1] as PieceType) : undefined
  const check = checkStr === '+' || san.includes('+')
  const checkmate = checkStr === '#' || san.includes('#')

  return { kind: 'normal', pieceType, dstSquare, hintFile, hintRank, capture, promotion, check, checkmate }
}

// ── Apply a move to GameState (for use by transitions builder) ────────────────

export type MoveApplication = {
  /** New position after the move */
  position: Position
  /** The piece that was captured, if any */
  captured: Piece | null
  /** The square from which the piece moved */
  fromSquare: Square
  /** The parsed move (avoids re-parsing in callers that need structural info) */
  parsed: ParsedMove
}

export function applyMove(position: Position, san: string): MoveApplication | null {
  const parsed = parseSAN(san)
  if (!parsed) return null

  const { board, activeColor } = position
  const color = activeColor

  if (parsed.kind === 'castle') {
    return { ...applyCastle(position, parsed.side), parsed }
  }

  const { pieceType, dstSquare, hintFile, hintRank, promotion } = parsed

  let fromSquare: Square | null

  if (pieceType === 'P') {
    if (parsed.capture) {
      // Pawn capture: source file is always given
      fromSquare = (hintFile ?? '') + (color === 'w'
        ? String(parseInt(dstSquare[1]!, 10) - 1)
        : String(parseInt(dstSquare[1]!, 10) + 1))
    } else {
      fromSquare = findPawnMoveSource(board, dstSquare[0]!, dstSquare[1]!, color)
    }
  } else {
    fromSquare = findMoveSource(board, pieceType, color, dstSquare, hintFile, hintRank)
  }

  if (!fromSquare) return null

  // Handle en passant capture
  let captured: Piece | null = boardGet(board, dstSquare)
  let epCaptureSquare: Square | null = null

  if (pieceType === 'P' && parsed.capture && captured === null) {
    epCaptureSquare = dstSquare[0]! + fromSquare[1]!
    captured = boardGet(board, epCaptureSquare)
  }

  // Build new board
  const newBoard = board.map(row => row.slice()) as typeof board

  const movingPiece = boardGet(newBoard, fromSquare)!
  newBoard[squareToCoord(fromSquare)[0]]![squareToCoord(fromSquare)[1]] = null
  if (epCaptureSquare) {
    newBoard[squareToCoord(epCaptureSquare)[0]]![squareToCoord(epCaptureSquare)[1]] = null
  }
  newBoard[squareToCoord(dstSquare)[0]]![squareToCoord(dstSquare)[1]] = promotion
    ? { ...movingPiece, type: promotion }
    : movingPiece

  // Update castling rights
  const cr: CastlingRights = { ...position.castlingRights }
  if (pieceType === 'K') {
    if (color === 'w') { cr.K = false; cr.Q = false }
    else               { cr.k = false; cr.q = false }
  }
  if (fromSquare === 'a1' || dstSquare === 'a1') cr.Q = false
  if (fromSquare === 'h1' || dstSquare === 'h1') cr.K = false
  if (fromSquare === 'a8' || dstSquare === 'a8') cr.q = false
  if (fromSquare === 'h8' || dstSquare === 'h8') cr.k = false

  // Update en passant square
  let newEP: Square | null = null
  if (pieceType === 'P') {
    const fromRank = parseInt(fromSquare[1]!, 10)
    const toRank = parseInt(dstSquare[1]!, 10)
    if (Math.abs(toRank - fromRank) === 2) {
      newEP = dstSquare[0]! + String(Math.floor((fromRank + toRank) / 2))
    }
  }

  return {
    position: new Position(
      newBoard,
      color === 'w' ? 'b' : 'w',
      cr,
      newEP,
      (pieceType === 'P' || captured !== null) ? 0 : position.halfmoveClock + 1,
      color === 'b' ? position.fullmoveNumber + 1 : position.fullmoveNumber,
    ),
    captured,
    fromSquare,
    parsed,
  }
}

function applyCastle(position: Position, side: 'K' | 'Q'): Omit<MoveApplication, 'parsed'> {
  const color = position.activeColor
  const rank = color === 'w' ? '1' : '8'

  const kingFrom: Square = 'e' + rank
  const kingTo:   Square = side === 'K' ? 'g' + rank : 'c' + rank
  const rookFrom: Square = side === 'K' ? 'h' + rank : 'a' + rank
  const rookTo:   Square = side === 'K' ? 'f' + rank : 'd' + rank

  const newBoard = position.board.map(row => row.slice()) as typeof position.board

  const king = boardGet(newBoard, kingFrom)!
  const rook = boardGet(newBoard, rookFrom)!

  newBoard[squareToCoord(kingFrom)[0]]![squareToCoord(kingFrom)[1]] = null
  newBoard[squareToCoord(rookFrom)[0]]![squareToCoord(rookFrom)[1]] = null
  newBoard[squareToCoord(kingTo)[0]]![squareToCoord(kingTo)[1]] = king
  newBoard[squareToCoord(rookTo)[0]]![squareToCoord(rookTo)[1]] = rook

  const cr: CastlingRights = { ...position.castlingRights }
  if (color === 'w') { cr.K = false; cr.Q = false }
  else               { cr.k = false; cr.q = false }

  return {
    position: new Position(
      newBoard,
      color === 'w' ? 'b' : 'w',
      cr,
      null,
      position.halfmoveClock + 1,
      color === 'b' ? position.fullmoveNumber + 1 : position.fullmoveNumber,
    ),
    captured: null,
    fromSquare: kingFrom,
  }
}
