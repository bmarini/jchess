import { allocatePieceId, boardGet, Position, resetPieceIds } from './board.js'
import { applyMove, parseSAN } from './moves.js'
import type { ParsedGame, Piece, Square, Transition, TransitionCommand } from './types.js'

// ── Build transition list from a parsed game ──────────────────────────────────

export type BuildResult = {
  transitions: Transition[]
  initialPosition: Position
  warnings: string[]
}

/**
 * Walk all moves in `game`, compute the position after each move,
 * and record the forward/backward TransitionCommands needed to drive the renderer.
 */
export function buildTransitions(game: ParsedGame, initial: Position): BuildResult {
  // Re-parse the FEN with a fresh ID sequence so piece IDs are contiguous from 0.
  // This guarantees the IDs embedded in transitions match what the renderer starts with.
  resetPieceIds()
  const initialPosition = Position.fromFEN(initial.toFEN())

  const transitions: Transition[] = []
  const warnings: string[] = []
  let position = initialPosition

  for (let i = 0; i < game.moves.length; i++) {
    const san = game.moves[i]!
    const annotation = game.annotations[i + 1]  // annotation trails the move

    const result = applyMove(position, san)
    if (!result) {
      warnings.push(`Could not apply move ${i + 1}: ${san}`)
      transitions.push({ forward: [], backward: [], san, annotation })
      continue
    }

    const forward: TransitionCommand[] = []
    const backward: TransitionCommand[] = []

    const parsed = parseSAN(san)!

    if (parsed.kind === 'castle') {
      buildCastleCommands(position, parsed.side, forward, backward)
    } else {
      const { fromSquare } = result
      const movingPiece = boardGet(position.board, fromSquare)!
      const { captured } = result

      if (captured) {
        const captureSquare = findCaptureSquare(position, parsed, fromSquare)
        forward.push({ op: 'remove', pieceId: captured.id, piece: captured, square: captureSquare })
        backward.push({ op: 'add', pieceId: captured.id, piece: captured, square: captureSquare })
      }

      if (parsed.promotion) {
        const promotedPiece: Piece = {
          color: movingPiece.color,
          type: parsed.promotion,
          id: allocatePieceId(),
        }
        forward.push({ op: 'remove', pieceId: movingPiece.id, piece: movingPiece, square: fromSquare })
        forward.push({ op: 'add',    pieceId: promotedPiece.id, piece: promotedPiece, square: parsed.dstSquare })
        backward.push({ op: 'remove', pieceId: promotedPiece.id, piece: promotedPiece, square: parsed.dstSquare })
        backward.push({ op: 'add',   pieceId: movingPiece.id,   piece: movingPiece,   square: fromSquare })
      } else {
        forward.push({ op: 'move', pieceId: movingPiece.id, from: fromSquare, to: parsed.dstSquare })
        backward.push({ op: 'move', pieceId: movingPiece.id, from: parsed.dstSquare, to: fromSquare })
      }
    }

    transitions.push({ forward, backward, san, annotation })
    position = result.position
  }

  return { transitions, initialPosition, warnings }
}

function findCaptureSquare(
  position: Position,
  parsed: ReturnType<typeof parseSAN> & { kind: 'normal' },
  fromSquare: Square,
): Square {
  if (
    parsed.pieceType === 'P' &&
    parsed.capture &&
    position.get(parsed.dstSquare) === null
  ) {
    return parsed.dstSquare[0]! + fromSquare[1]!
  }
  return parsed.dstSquare
}

function buildCastleCommands(
  position: Position,
  side: 'K' | 'Q',
  forward: TransitionCommand[],
  backward: TransitionCommand[],
): void {
  const rank = position.activeColor === 'w' ? '1' : '8'

  const kingFrom: Square = 'e' + rank
  const kingTo:   Square = side === 'K' ? 'g' + rank : 'c' + rank
  const rookFrom: Square = side === 'K' ? 'h' + rank : 'a' + rank
  const rookTo:   Square = side === 'K' ? 'f' + rank : 'd' + rank

  const king = position.get(kingFrom)!
  const rook = position.get(rookFrom)!

  forward.push({ op: 'move', pieceId: king.id, from: kingFrom, to: kingTo })
  forward.push({ op: 'move', pieceId: rook.id, from: rookFrom, to: rookTo })
  backward.push({ op: 'move', pieceId: king.id, from: kingTo, to: kingFrom })
  backward.push({ op: 'move', pieceId: rook.id, from: rookTo, to: rookFrom })
}

// ── GamePlayer: navigate via transitions ──────────────────────────────────────

export class GamePlayer {
  readonly transitions: Transition[]
  readonly initialPosition: Position
  private _halfmove: number = 0

  constructor(result: BuildResult) {
    this.transitions = result.transitions
    this.initialPosition = result.initialPosition
  }

  get halfmove(): number { return this._halfmove }
  get totalMoves(): number { return this.transitions.length }
  get currentSAN(): string | null {
    return this._halfmove > 0 ? (this.transitions[this._halfmove - 1]?.san ?? null) : null
  }
  get currentAnnotation(): string | undefined {
    return this._halfmove > 0
      ? this.transitions[this._halfmove - 1]?.annotation
      : this.transitions[0]?.annotation
  }

  canGoForward(): boolean { return this._halfmove < this.transitions.length }
  canGoBackward(): boolean { return this._halfmove > 0 }

  /** Returns the forward transition commands for this step. */
  stepForward(): TransitionCommand[] | null {
    if (!this.canGoForward()) return null
    const t = this.transitions[this._halfmove]!
    this._halfmove++
    return t.forward
  }

  /** Returns the backward transition commands for this step. */
  stepBackward(): TransitionCommand[] | null {
    if (!this.canGoBackward()) return null
    this._halfmove--
    return this.transitions[this._halfmove]!.backward
  }

  /** Jump directly to a half-move. The renderer should call `render(stateAt(n))` after. */
  jumpTo(n: number): void {
    this._halfmove = Math.max(0, Math.min(n, this.transitions.length))
  }

  /**
   * Compute the position at half-move `n` by replaying moves from the initial position.
   * Used by `jumpTo` so the renderer can re-render without animating each step.
   */
  positionAt(n: number): Position {
    let pos = this.initialPosition
    const limit = Math.min(n, this.transitions.length)
    for (let i = 0; i < limit; i++) {
      const result = applyMove(pos, this.transitions[i]!.san)
      if (result) pos = result.position
    }
    return pos
  }
}
