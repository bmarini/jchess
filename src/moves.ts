/**
 * Re-exports from board.ts for backward compatibility.
 * Prefer using Position methods directly:
 *   position.applyMove(san)
 *   position.toSAN(from, to, promotion?)
 *   position.legalMovesFrom(from)
 */
export {
  findMoveSource,
  findPawnMoveSource,
  parseSAN,
  PIECE_VECTORS,
} from './board.js'

export type { ParsedSAN, MoveApplication } from './board.js'

import { Position } from './board.js'
import type { MoveApplication } from './board.js'
import type { PieceType, Square } from './types.js'

/** @deprecated Use position.applyMove(san) instead */
export function applyMove(position: Position, san: string): MoveApplication | null {
  return position.applyMove(san)
}

/** @deprecated Use position.toSAN(from, to, promotion?) instead */
export function toSAN(position: Position, from: Square, to: Square, promotion?: PieceType): string | null {
  return position.toSAN(from, to, promotion)
}

/** @deprecated Use position.legalMovesFrom(from) instead */
export function legalMovesFrom(position: Position, from: Square): Square[] {
  return position.legalMovesFrom(from)
}
