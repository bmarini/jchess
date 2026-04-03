import { makeIdCounter, Position } from './board.js'
import { applyMove } from './moves.js'
import { parsePGN } from './pgn.js'
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
  // Use a single IdCounter for the whole build so all piece IDs — including
  // those assigned during fromFEN and any promotion pieces — form one contiguous
  // sequence that the renderer can rely on.
  const ids = makeIdCounter()
  const initialPosition = Position.fromFEN(initial.toFEN(), ids)

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

    const { parsed } = result

    if (parsed.kind === 'castle') {
      buildCastleCommands(position, parsed.side, forward, backward)
    } else {
      const { fromSquare } = result
      const movingPiece = position.get(fromSquare)!
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
          id: ids.next(),
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
  private _positions: Position[]

  constructor(result: BuildResult) {
    this.transitions = result.transitions
    this.initialPosition = result.initialPosition
    // Pre-compute all positions so positionAt() is O(1)
    this._positions = [result.initialPosition]
    let pos = result.initialPosition
    for (const t of result.transitions) {
      const r = applyMove(pos, t.san)
      if (r) pos = r.position
      this._positions.push(pos)
    }
  }

  static fromPGN(pgn: string, options?: { fen?: string }): GamePlayer {
    const initial = options?.fen ? Position.fromFEN(options.fen) : Position.starting()
    return new GamePlayer(buildTransitions(parsePGN(pgn), initial))
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

  /** Return the position at half-move `n` in O(1). */
  positionAt(n: number): Position {
    const i = Math.max(0, Math.min(n, this._positions.length - 1))
    return this._positions[i]!
  }
}
