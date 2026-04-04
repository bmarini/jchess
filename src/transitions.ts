import { makeIdCounter, Position } from './board.js'
import { applyMove } from './moves.js'
import { parsePGN } from './pgn.js'
import type { IdCounter } from './board.js'
import type { ParsedSAN } from './moves.js'
import type { ParsedGame, ParsedMove, Piece, Square, Transition, TransitionCommand } from './types.js'

// ── Build transition list from a parsed game ──────────────────────────────────

export type BuildResult = {
  transitions: Transition[]
  initialPosition: Position
  warnings: string[]
  ids: IdCounter
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

// ── Single transition builder ────────────────────────────────────────────────

export type SingleTransitionResult = {
  transition: Transition
  newPosition: Position
}

/**
 * Build a single Transition from a position and a SAN move.
 * Returns the transition and the resulting position, or null if the move is invalid.
 */
export function buildSingleTransition(
  position: Position,
  san: string,
  ids: IdCounter,
): SingleTransitionResult | null {
  const result = applyMove(position, san)
  if (!result) return null

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

  return {
    transition: { forward, backward, san, variations: [] },
    newPosition: result.position,
  }
}

// ── Transition list builder (uses buildSingleTransition) ─────────────────────

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

    const result = buildSingleTransition(position, parsedMove.san, ids)
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

    result.transition.annotation = parsedMove.annotation
    result.transition.variations = variationTransitions
    transitions.push(result.transition)
    position = result.newPosition
  }

  return { transitions, warnings }
}

/**
 * Walk all moves in `game`, compute the position after each move,
 * and record the forward/backward TransitionCommands needed to drive the renderer.
 */
export function buildTransitions(game: ParsedGame, initial: Position): BuildResult {
  const ids = makeIdCounter()
  const initialPosition = Position.fromFEN(initial.toFEN(), ids)

  const { transitions, warnings } = buildTransitionList(game.moves, initialPosition, ids)

  return { transitions, initialPosition, warnings, ids }
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

type VarStep = { halfmove: number; varIndex: number }

type LineState = {
  transitions: Transition[]
  /** positions[n] = board state after n half-moves (positions[0] = start of this line) */
  positions: Position[]
  halfmove: number
  /** How this line was entered from the parent (undefined for the root/main line). */
  enteredFrom?: VarStep
}

export class GamePlayer {
  readonly initialPosition: Position
  private _stack: LineState[]
  private _ids: IdCounter

  constructor(result: BuildResult) {
    this.initialPosition = result.initialPosition
    this._ids = result.ids
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

  /** The main line transitions (always the root, even when inside a variation). */
  get mainTransitions(): Transition[] { return this._stack[0]!.transitions }

  /** The main line halfmove (branch point when inside a variation). */
  get mainHalfmove(): number { return this._stack[0]!.halfmove }

  get halfmove(): number { return this._cur.halfmove }
  get totalMoves(): number { return this._cur.transitions.length }
  get isInVariation(): boolean { return this._stack.length > 1 }

  /** The path of variation steps from the main line to the current position. */
  get variationPath(): VarStep[] {
    return this._stack.slice(1).map(frame => frame.enteredFrom!)
  }

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
    this._stack.push({
      transitions: varTransitions,
      positions,
      halfmove: 0,
      enteredFrom: { halfmove: this._cur.halfmove, varIndex: variationIndex },
    })
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

  /**
   * Make a move at the current position. Handles:
   * - Advancing if the move matches the next transition
   * - Entering an existing variation that starts with this move
   * - Appending at end of line
   * - Creating a new variation mid-line
   * Returns the forward commands, or null if the move is invalid.
   */
  makeMove(san: string): TransitionCommand[] | null {
    const cur = this._cur
    const nextTransition = cur.transitions[cur.halfmove]

    // If there's a next move in the current line...
    if (nextTransition) {
      // Case 1: matches the existing next move — just advance
      if (nextTransition.san === san) {
        return this.stepForward()
      }

      // Case 2: matches an existing variation — enter it and advance
      for (let i = 0; i < nextTransition.variations.length; i++) {
        const varLine = nextTransition.variations[i]!
        if (varLine.length > 0 && varLine[0]!.san === san) {
          this.enterVariation(i)
          return this.stepForward()
        }
      }

      // Case 3: new variation
      const position = this.positionAt(cur.halfmove)
      const result = buildSingleTransition(position, san, this._ids)
      if (!result) return null

      nextTransition.variations.push([result.transition])
      const varIndex = nextTransition.variations.length - 1
      this.enterVariation(varIndex)
      return this.stepForward()
    }

    // Case 4: at end of line — append
    const position = this.positionAt(cur.halfmove)
    const result = buildSingleTransition(position, san, this._ids)
    if (!result) return null

    cur.transitions.push(result.transition)
    cur.positions.push(result.newPosition)
    return this.stepForward()
  }
}
