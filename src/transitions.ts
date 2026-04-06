import { parseAnnotation } from './annotation.js'
import { makeIdCounter, Position, toSquare } from './board.js'
import { parsePGN } from './pgn.js'
import type { IdCounter, ParsedSAN } from './board.js'
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
    return toSquare(parsed.dstSquare[0]!, fromSquare[1]!)
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

  const kingFrom: Square = toSquare('e', rank)
  const kingTo:   Square = side === 'K' ? toSquare('g', rank) : toSquare('c', rank)
  const rookFrom: Square = side === 'K' ? toSquare('h', rank) : toSquare('a', rank)
  const rookTo:   Square = side === 'K' ? toSquare('f', rank) : toSquare('d', rank)

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

export function buildSingleTransition(
  position: Position,
  san: string,
  ids: IdCounter,
): SingleTransitionResult | null {
  const result = position.applyMove(san)
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

// ── Transition list builder ──────────────────────────────────────────────────

function buildTransitionList(
  moves: ParsedMove[],
  initial: Position,
  ids: IdCounter,
): { transitions: Transition[]; warnings: string[] } {
  const transitions: Transition[] = []
  const warnings: string[] = []
  let position = initial

  for (const parsedMove of moves) {
    const variationTransitions: Transition[][] = []
    for (const varMoves of parsedMove.variations) {
      const sub = buildTransitionList(varMoves, position, ids)
      warnings.push(...sub.warnings)
      variationTransitions.push(sub.transitions)
    }

    const result = buildSingleTransition(position, parsedMove.san, ids)
    if (!result) {
      warnings.push(`Could not apply move: ${parsedMove.san}`)
      const failedAnno = parsedMove.annotation ? parseAnnotation(parsedMove.annotation) : undefined
      transitions.push({
        forward: [], backward: [],
        san: parsedMove.san,
        annotation: failedAnno?.text || undefined,
        metadata: failedAnno && Object.keys(failedAnno.metadata).length > 0 ? failedAnno.metadata : undefined,
        variations: variationTransitions,
      })
      continue
    }

    if (parsedMove.annotation) {
      const parsed = parseAnnotation(parsedMove.annotation)
      result.transition.annotation = parsed.text || undefined
      if (Object.keys(parsed.metadata).length > 0) {
        result.transition.metadata = parsed.metadata
      }
    }
    result.transition.variations = variationTransitions
    transitions.push(result.transition)
    position = result.newPosition
  }

  return { transitions, warnings }
}

export function buildTransitions(game: ParsedGame, initial: Position): BuildResult {
  const ids = makeIdCounter()
  const initialPosition = Position.fromFEN(initial.toFEN(), ids)
  const { transitions, warnings } = buildTransitionList(game.moves, initialPosition, ids)
  return { transitions, initialPosition, warnings, ids }
}

// ── Line: a navigable sequence of transitions ────────────────────────────────

type VarStep = { halfmove: number; varIndex: number }

/**
 * A line of play (main line or variation) with its transitions, pre-computed
 * positions, and a cursor (halfmove) for navigation.
 */
export class Line {
  private _transitions: Transition[]
  private _positions: Position[]
  private _halfmove: number
  /** How this line was entered from the parent (undefined for root). */
  readonly enteredFrom?: VarStep

  constructor(transitions: Transition[], startPos: Position, enteredFrom?: VarStep) {
    this._transitions = transitions
    this._positions = Line._computePositions(transitions, startPos)
    this._halfmove = 0
    this.enteredFrom = enteredFrom
  }

  private static _computePositions(transitions: Transition[], startPos: Position): Position[] {
    const positions: Position[] = [startPos]
    let pos = startPos
    for (const t of transitions) {
      const r = pos.applyMove(t.san)
      if (r) pos = r.position
      positions.push(pos)
    }
    return positions
  }

  get transitions(): Transition[] { return this._transitions }
  get halfmove(): number { return this._halfmove }
  get totalMoves(): number { return this._transitions.length }

  get currentSAN(): string | null {
    return this._halfmove > 0
      ? (this._transitions[this._halfmove - 1]?.san ?? null)
      : null
  }

  get currentAnnotation(): string | undefined {
    return this._halfmove > 0
      ? this._transitions[this._halfmove - 1]?.annotation
      : this._transitions[0]?.annotation
  }

  get currentMetadata(): import('./types.js').MoveMetadata | undefined {
    return this._halfmove > 0
      ? this._transitions[this._halfmove - 1]?.metadata
      : undefined
  }

  canGoForward(): boolean { return this._halfmove < this._transitions.length }
  canGoBackward(): boolean { return this._halfmove > 0 }

  stepForward(): TransitionCommand[] | null {
    if (!this.canGoForward()) return null
    const t = this._transitions[this._halfmove]!
    this._halfmove++
    return t.forward
  }

  stepBackward(): TransitionCommand[] | null {
    if (!this.canGoBackward()) return null
    this._halfmove--
    return this._transitions[this._halfmove]!.backward
  }

  jumpTo(n: number): void {
    this._halfmove = Math.max(0, Math.min(n, this._transitions.length))
  }

  positionAt(n: number): Position {
    const i = Math.max(0, Math.min(n, this._positions.length - 1))
    return this._positions[i]!
  }

  /** Append a transition at the end of this line. */
  append(transition: Transition, newPosition: Position): void {
    this._transitions.push(transition)
    this._positions.push(newPosition)
  }
}

// ── GamePlayer: stack-based navigation across lines ──────────────────────────

export class GamePlayer {
  readonly initialPosition: Position
  private _stack: Line[]
  private _ids: IdCounter

  constructor(result: BuildResult) {
    this.initialPosition = result.initialPosition
    this._ids = result.ids
    this._stack = [new Line(result.transitions, result.initialPosition)]
  }

  static fromPGN(pgn: string, options?: { fen?: string }): GamePlayer {
    const initial = options?.fen ? Position.fromFEN(options.fen) : Position.starting()
    return new GamePlayer(buildTransitions(parsePGN(pgn), initial))
  }

  private get _cur(): Line { return this._stack[this._stack.length - 1]! }

  // ── Delegate to current line ───────────────────────────────────────────────

  get transitions(): Transition[] { return this._cur.transitions }
  get halfmove(): number { return this._cur.halfmove }
  get totalMoves(): number { return this._cur.totalMoves }
  get currentSAN(): string | null { return this._cur.currentSAN }
  get currentAnnotation(): string | undefined { return this._cur.currentAnnotation }
  get currentMetadata(): import('./types.js').MoveMetadata | undefined { return this._cur.currentMetadata }

  canGoForward(): boolean { return this._cur.canGoForward() }
  canGoBackward(): boolean { return this._cur.canGoBackward() }
  stepForward(): TransitionCommand[] | null { return this._cur.stepForward() }
  stepBackward(): TransitionCommand[] | null { return this._cur.stepBackward() }
  jumpTo(n: number): void { this._cur.jumpTo(n) }
  positionAt(n: number): Position { return this._cur.positionAt(n) }

  // ── Stack-level operations ─────────────────────────────────────────────────

  get mainTransitions(): Transition[] { return this._stack[0]!.transitions }
  get mainHalfmove(): number { return this._stack[0]!.halfmove }
  get isInVariation(): boolean { return this._stack.length > 1 }

  get variationPath(): VarStep[] {
    return this._stack.slice(1).map(line => line.enteredFrom!)
  }

  enterVariation(variationIndex: number): Position {
    const t = this._cur.transitions[this._cur.halfmove]
    const varTransitions = t?.variations[variationIndex]
    if (!varTransitions || varTransitions.length === 0) {
      return this.positionAt(this._cur.halfmove)
    }

    const startPos = this.positionAt(this._cur.halfmove)
    this._stack.push(new Line(
      varTransitions,
      startPos,
      { halfmove: this._cur.halfmove, varIndex: variationIndex },
    ))
    return startPos
  }

  exitVariation(): Position {
    if (this._stack.length > 1) this._stack.pop()
    return this.positionAt(this._cur.halfmove)
  }

  /** Set the annotation on the current move. Pass empty string to clear. */
  setAnnotation(text: string): void {
    if (this._cur.halfmove === 0) return
    const t = this._cur.transitions[this._cur.halfmove - 1]
    if (!t) return
    t.annotation = text || undefined
  }

  /** Jump to a position within a (possibly nested) variation by following a path. */
  jumpToVariation(path: VarStep[], varHalfmove: number): void {
    while (this.isInVariation) this.exitVariation()
    for (const step of path) {
      this.jumpTo(step.halfmove)
      this.enterVariation(step.varIndex)
    }
    this.jumpTo(varHalfmove)
  }

  /** Remove a variation identified by its path. Exits to main line after removal. */
  removeVariation(path: VarStep[]): void {
    if (path.length === 0) return

    // Exit any current variation
    while (this.isInVariation) this.exitVariation()

    // Navigate into the parent line (all steps except the last)
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i]!
      this.jumpTo(step.halfmove)
      this.enterVariation(step.varIndex)
    }

    // Remove the variation at the last step
    const lastStep = path[path.length - 1]!
    const parentTransition = this._cur.transitions[lastStep.halfmove]
    if (parentTransition && lastStep.varIndex < parentTransition.variations.length) {
      parentTransition.variations.splice(lastStep.varIndex, 1)
    }

    // Exit back to main line
    while (this.isInVariation) this.exitVariation()
  }

  makeMove(san: string): TransitionCommand[] | null {
    const cur = this._cur
    const nextTransition = cur.transitions[cur.halfmove]

    if (nextTransition) {
      // Case 1: matches the existing next move
      if (nextTransition.san === san) {
        return this.stepForward()
      }

      // Case 2: matches an existing variation
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

    cur.append(result.transition, result.newPosition)
    return this.stepForward()
  }
}
