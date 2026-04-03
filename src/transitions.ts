import { makeIdCounter, Position } from './board.js'
import { applyMove, parseSAN } from './moves.js'
import { parsePGN } from './pgn.js'
import type { IdCounter } from './board.js'
import type { ParsedSAN } from './moves.js'
import type { ParsedGame, ParsedMove, Piece, Square, Transition, TransitionCommand } from './types.js'

// ── Build transition list from a parsed game ──────────────────────────────────

export type BuildResult = {
  transitions: Transition[]
  initialPosition: Position
  warnings: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function findCaptureSquare(
  position: Position,
  parsed: ParsedSAN & { kind: 'normal' },
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

/**
 * Build a flat Transition[] for `moves`, starting from `initial`.
 * Recursively builds transitions for each move's variations too.
 */
function buildTransitionList(
  moves: ParsedMove[],
  initial: Position,
  ids: IdCounter,
): { transitions: Transition[]; warnings: string[] } {
  const transitions: Transition[] = []
  const warnings: string[] = []
  let position = initial

  for (const parsedMove of moves) {
    // Build variation transitions from the position BEFORE this move
    const variationTransitions: Transition[][] = []
    for (const varMoves of parsedMove.variations) {
      const sub = buildTransitionList(varMoves, position, ids)
      warnings.push(...sub.warnings)
      variationTransitions.push(sub.transitions)
    }

    const result = applyMove(position, parsedMove.san)
    if (!result) {
      warnings.push(`Could not apply move: ${parsedMove.san}`)
      transitions.push({
        forward: [], backward: [],
        san: parsedMove.san,
        annotation: parsedMove.annotation,
        variations: variationTransitions,
      })
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

    transitions.push({
      forward, backward,
      san: parsedMove.san,
      annotation: parsedMove.annotation,
      variations: variationTransitions,
    })
    position = result.position
  }

  return { transitions, warnings }
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

  const { transitions, warnings } = buildTransitionList(game.moves, initialPosition, ids)

  return { transitions, initialPosition, warnings }
}

// ── Position computation helper ───────────────────────────────────────────────

/** Replay `transitions` from `startPos` and return the resulting Position[] (index 0 = startPos). */
function computePositions(transitions: Transition[], startPos: Position): Position[] {
  const positions: Position[] = [startPos]
  let pos = startPos
  for (const t of transitions) {
    const r = applyMove(pos, t.san)
    if (r) pos = r.position
    positions.push(pos)
  }
  return positions
}

// ── GamePlayer: navigate via transitions ──────────────────────────────────────

type LineState = {
  transitions: Transition[]
  /** positions[n] = board state after n half-moves (positions[0] = start of this line) */
  positions: Position[]
  halfmove: number
}

export class GamePlayer {
  readonly initialPosition: Position
  private _stack: LineState[]

  constructor(result: BuildResult) {
    this.initialPosition = result.initialPosition
    const positions = computePositions(result.transitions, result.initialPosition)
    this._stack = [{ transitions: result.transitions, positions, halfmove: 0 }]
  }

  static fromPGN(pgn: string, options?: { fen?: string }): GamePlayer {
    const initial = options?.fen ? Position.fromFEN(options.fen) : Position.starting()
    return new GamePlayer(buildTransitions(parsePGN(pgn), initial))
  }

  private get _cur(): LineState { return this._stack[this._stack.length - 1]! }

  /** The transitions for the currently active line (main line or a variation). */
  get transitions(): Transition[] { return this._cur.transitions }

  get halfmove(): number { return this._cur.halfmove }
  get totalMoves(): number { return this._cur.transitions.length }
  get isInVariation(): boolean { return this._stack.length > 1 }

  get currentSAN(): string | null {
    return this._cur.halfmove > 0
      ? (this._cur.transitions[this._cur.halfmove - 1]?.san ?? null)
      : null
  }

  get currentAnnotation(): string | undefined {
    return this._cur.halfmove > 0
      ? this._cur.transitions[this._cur.halfmove - 1]?.annotation
      : this._cur.transitions[0]?.annotation
  }

  canGoForward(): boolean { return this._cur.halfmove < this._cur.transitions.length }
  canGoBackward(): boolean { return this._cur.halfmove > 0 }

  /** Returns the forward transition commands for this step. */
  stepForward(): TransitionCommand[] | null {
    if (!this.canGoForward()) return null
    const t = this._cur.transitions[this._cur.halfmove]!
    this._cur.halfmove++
    return t.forward
  }

  /** Returns the backward transition commands for this step. */
  stepBackward(): TransitionCommand[] | null {
    if (!this.canGoBackward()) return null
    this._cur.halfmove--
    return this._cur.transitions[this._cur.halfmove]!.backward
  }

  /** Jump directly to a half-move within the current line. */
  jumpTo(n: number): void {
    this._cur.halfmove = Math.max(0, Math.min(n, this._cur.transitions.length))
  }

  /** Return the position at half-move `n` within the current line in O(1). */
  positionAt(n: number): Position {
    const i = Math.max(0, Math.min(n, this._cur.positions.length - 1))
    return this._cur.positions[i]!
  }

  /**
   * Enter variation `variationIndex` at the current halfmove position.
   * Returns the starting position of the variation (for the renderer to re-render).
   */
  enterVariation(variationIndex: number): Position {
    const t = this._cur.transitions[this._cur.halfmove]
    const varTransitions = t?.variations[variationIndex]
    if (!varTransitions || varTransitions.length === 0) {
      return this.positionAt(this._cur.halfmove)
    }

    const startPos = this.positionAt(this._cur.halfmove)
    const positions = computePositions(varTransitions, startPos)
    this._stack.push({ transitions: varTransitions, positions, halfmove: 0 })
    return startPos
  }

  /**
   * Exit the current variation and return to the parent line.
   * Returns the parent line's current position (for the renderer to re-render).
   */
  exitVariation(): Position {
    if (this._stack.length > 1) this._stack.pop()
    return this.positionAt(this._cur.halfmove)
  }
}

