/**
 * Move generation layer — sits above Position (Layer 1) and provides:
 * - toSAN: convert board coordinates to SAN notation
 * - legalMovesFrom: all legal destination squares for a piece
 * - hasAnyLegalMove: fast check if any legal move exists
 *
 * Dependency direction: movegen → board (Position, applyMove, isInCheck)
 * No circular dependencies — toSAN uses hasAnyLegalMove (not legalMovesFrom).
 */

import { Position, coordToSquare, squareToCoord, isOnBoard, boardGet, findMoveSource, PIECE_VECTORS, toSquare } from './board.js'
import type { PieceType, Square } from './types.js'

// ── Check suffix ─────────────────────────────────────────────────────────────

/**
 * Return '+' if the position is in check, '#' if checkmate, '' otherwise.
 * Uses hasAnyLegalMove (Layer 2) — never calls legalMovesFrom or toSAN.
 */
function checkSuffix(position: Position): string {
  if (!position.isInCheck()) return ''
  return hasAnyLegalMove(position) ? '+' : '#'
}

// ── hasAnyLegalMove ──────────────────────────────────────────────────────────

/**
 * Fast check if the position has any legal move.
 * Uses applyMove directly (Layer 1) — no toSAN, no legalMovesFrom.
 */
export function hasAnyLegalMove(position: Position): boolean {
  const color = position.activeColor
  const FILES = 'abcdefgh'

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = position.board[r]?.[c]
      if (!piece || piece.color !== color) continue

      if (piece.type === 'P') {
        const dir = color === 'w' ? -1 : 1
        const promoRank = color === 'w' ? 0 : 7
        const startRow = color === 'w' ? 6 : 1
        const r1 = r + dir
        if (isOnBoard(r1, c) && !boardGet(position.board, coordToSquare(r1, c))) {
          const to = coordToSquare(r1, c)
          if (r1 === promoRank) {
            if (position.applyMove(`${to}=Q`)) return true
          } else {
            if (position.applyMove(to)) return true
          }
          if (r === startRow) {
            const r2 = r + dir * 2
            if (isOnBoard(r2, c) && !boardGet(position.board, coordToSquare(r2, c))) {
              if (position.applyMove(coordToSquare(r2, c))) return true
            }
          }
        }
        for (const dc of [-1, 1]) {
          if (!isOnBoard(r1, c + dc)) continue
          const to = coordToSquare(r1, c + dc)
          const target = boardGet(position.board, to)
          if ((target && target.color !== color) || to === position.enPassantSquare) {
            const san = `${FILES[c]}x${to}${r1 === promoRank ? '=Q' : ''}`
            if (position.applyMove(san)) return true
          }
        }
      } else if (piece.type === 'K') {
        for (const vec of PIECE_VECTORS['K']) {
          const nr = r - vec.y, nc = c + vec.x
          if (!isOnBoard(nr, nc)) continue
          const target = position.board[nr]?.[nc]
          if (target && target.color === color) continue
          const to = coordToSquare(nr, nc)
          if (position.applyMove(target ? `Kx${to}` : `K${to}`)) return true
        }
        if (position.applyMove('O-O')) return true
        if (position.applyMove('O-O-O')) return true
      } else {
        const from = coordToSquare(r, c)
        for (const vec of PIECE_VECTORS[piece.type]) {
          for (let steps = 1; steps <= vec.limit; steps++) {
            const nr = r - vec.y * steps, nc = c + vec.x * steps
            if (!isOnBoard(nr, nc)) break
            const target = position.board[nr]?.[nc]
            if (target && target.color === color) break
            const to = coordToSquare(nr, nc)
            const x = target ? 'x' : ''
            if (position.applyMove(`${piece.type}${x}${to}`)) return true
            if (position.applyMove(`${piece.type}${from[0]}${x}${to}`)) return true
            if (target) break
          }
        }
      }
    }
  }
  return false
}

// ── toSAN ────────────────────────────────────────────────────────────────────

/**
 * Convert a board move (from/to squares) to SAN notation, or null if illegal.
 * Calls checkSuffix → hasAnyLegalMove. Never calls legalMovesFrom.
 */
export function toSAN(position: Position, from: Square, to: Square, promotion?: PieceType): string | null {
  const piece = position.get(from)
  if (!piece || piece.color !== position.activeColor) return null

  const rank = position.activeColor === 'w' ? '1' : '8'

  // Castling
  if (piece.type === 'K') {
    if (from === toSquare('e', rank) && to === toSquare('g', rank)) {
      const result = position.applyMove('O-O')
      if (!result) return null
      return 'O-O' + checkSuffix(result.position)
    }
    if (from === toSquare('e', rank) && to === toSquare('c', rank)) {
      const result = position.applyMove('O-O-O')
      if (!result) return null
      return 'O-O-O' + checkSuffix(result.position)
    }
  }

  const target = position.get(to)
  const isCapture = target !== null || (piece.type === 'P' && from[0] !== to[0])
  const x = isCapture ? 'x' : ''

  // Pawn
  if (piece.type === 'P') {
    const fileStr = isCapture ? from[0]! : ''
    const promoStr = promotion ? `=${promotion}` : ''
    const san = `${fileStr}${x}${to}${promoStr}`
    const result = position.applyMove(san)
    if (!result) return null
    return san + checkSuffix(result.position)
  }

  // Pieces — find minimal disambiguation
  const p = piece.type
  const tempBoard = position.board.map(r => r.slice()) as typeof position.board
  const [fromRow, fromCol] = squareToCoord(from)
  tempBoard[fromRow]![fromCol] = null

  const competitor = findMoveSource(tempBoard, p, position.activeColor, to)
  let disambig = ''
  if (competitor) {
    if (competitor[0] !== from[0]) {
      disambig = from[0]!
    } else if (competitor[1] !== from[1]) {
      disambig = from[1]!
    } else {
      disambig = from
    }
  }

  const san = `${p}${disambig}${x}${to}`
  const result = position.applyMove(san)
  if (!result || result.fromSquare !== from) return null
  return san + checkSuffix(result.position)
}

// ── legalMovesFrom ───────────────────────────────────────────────────────────

/**
 * Return all legal destination squares for the piece on `from`.
 * Calls toSAN to validate each candidate — safe because toSAN → checkSuffix → hasAnyLegalMove,
 * which does NOT call legalMovesFrom. No cycle.
 */
export function legalMovesFrom(position: Position, from: Square): Square[] {
  const piece = position.get(from)
  if (!piece || piece.color !== position.activeColor) return []

  const candidates: Square[] = []
  const [row, col] = squareToCoord(from)
  const color = piece.color

  if (piece.type === 'P') {
    const dir = color === 'w' ? -1 : 1
    const startRow = color === 'w' ? 6 : 1

    const r1 = row + dir
    if (isOnBoard(r1, col) && !boardGet(position.board, coordToSquare(r1, col))) {
      candidates.push(coordToSquare(r1, col))
      const r2 = row + dir * 2
      if (row === startRow && isOnBoard(r2, col) && !boardGet(position.board, coordToSquare(r2, col))) {
        candidates.push(coordToSquare(r2, col))
      }
    }

    for (const dc of [-1, 1]) {
      const nc = col + dc
      if (!isOnBoard(r1, nc)) continue
      const sq = coordToSquare(r1, nc)
      const tgt = boardGet(position.board, sq)
      if ((tgt && tgt.color !== color) || sq === position.enPassantSquare) {
        candidates.push(sq)
      }
    }
  } else {
    const vectors = PIECE_VECTORS[piece.type]
    for (const vec of vectors) {
      for (let steps = 1; steps <= vec.limit; steps++) {
        const nr = row - vec.y * steps
        const nc = col + vec.x * steps
        if (!isOnBoard(nr, nc)) break
        const sq = coordToSquare(nr, nc)
        const tgt = boardGet(position.board, sq)
        if (tgt && tgt.color === color) break
        candidates.push(sq)
        if (tgt) break
      }
    }

    if (piece.type === 'K') {
      const r = color === 'w' ? '1' : '8'
      if (from === toSquare('e', r)) {
        candidates.push(toSquare('g', r), toSquare('c', r))
      }
    }
  }

  return candidates.filter(to => toSAN(position, from, to) !== null)
}
