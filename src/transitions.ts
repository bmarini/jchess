import { allocatePieceId, boardGet, parseFEN, resetPieceIds } from './board.js'
import { applyMove, parseSAN } from './moves.js'
import type {
  GameState, ParsedGame, Piece, Square, Transition, TransitionCommand,
} from './types.js'

// ── Build transition list from a parsed game ──────────────────────────────────

export type BuildResult = {
  transitions: Transition[]
  initialState: GameState
  warnings: string[]
}

/**
 * Walk all moves in `game`, compute the board state after each move,
 * and record the forward/backward TransitionCommands needed to drive the renderer.
 */
export function buildTransitions(game: ParsedGame, initialState: GameState): BuildResult {
  resetPieceIds()

  // Re-parse the FEN so piece IDs are freshly assigned from 0.
  // We need to use the same ID-assignment logic the renderer will use.
  const startState = reParseFENWithIds(initialState)

  const transitions: Transition[] = []
  const warnings: string[] = []
  let state = startState

  for (let i = 0; i < game.moves.length; i++) {
    const san = game.moves[i]!
    const annotation = game.annotations[i + 1]  // annotation trails the move

    const result = applyMove(state, san)
    if (!result) {
      warnings.push(`Could not apply move ${i + 1}: ${san}`)
      // Insert a no-op transition so indices stay aligned
      transitions.push({ forward: [], backward: [], san, annotation })
      continue
    }

    const forward: TransitionCommand[] = []
    const backward: TransitionCommand[] = []

    const parsed = parseSAN(san)!

    if (parsed.kind === 'castle') {
      // Castle: king + rook each need a move command
      buildCastleCommands(state, result.state, parsed.side, forward, backward)
    } else {
      const { fromSquare } = result
      const movingPiece = boardGet(state.board, fromSquare)!
      const captured = result.captured

      // Remove captured piece first (in forward)
      if (captured) {
        // For en passant the capture square differs from the destination
        const captureSquare = findCaptureSquare(state, parsed, fromSquare)
        forward.push({ op: 'remove', pieceId: captured.id, piece: captured, square: captureSquare })
        backward.push({ op: 'add', pieceId: captured.id, piece: captured, square: captureSquare })
      }

      if (parsed.promotion) {
        // Pawn disappears, new piece appears
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
    state = result.state
  }

  return { transitions, initialState: startState, warnings }
}

function reParseFENWithIds(state: GameState): GameState {
  // Build a minimal FEN from the state and re-parse to get fresh sequential piece IDs.
  // This guarantees the IDs embedded in transitions match what the renderer starts with.
  resetPieceIds()
  const ranks = state.board.map(row =>
    row.map(p => p === null ? '-' : (p.color === 'w' ? p.type : p.type.toLowerCase())).join('')
      .replace(/-+/g, m => String(m.length))
  ).join('/')
  const color = state.activeColor
  const cr = state.castlingRights
  const castleStr = [
    cr.K ? 'K' : '', cr.Q ? 'Q' : '', cr.k ? 'k' : '', cr.q ? 'q' : '',
  ].join('') || '-'
  const ep = state.enPassantSquare ?? '-'
  const fen = `${ranks} ${color} ${castleStr} ${ep} ${state.halfmoveClock} ${state.fullmoveNumber}`
  return parseFEN(fen)
}

function findCaptureSquare(
  state: GameState,
  parsed: ReturnType<typeof parseSAN> & { kind: 'normal' },
  fromSquare: Square,
): Square {
  // En passant: the captured pawn is on the same rank as the moving pawn's source
  if (
    parsed.pieceType === 'P' &&
    parsed.capture &&
    boardGet(state.board, parsed.dstSquare) === null
  ) {
    return parsed.dstSquare[0]! + fromSquare[1]!
  }
  return parsed.dstSquare
}

function buildCastleCommands(
  before: GameState,
  _after: GameState,
  side: 'K' | 'Q',
  forward: TransitionCommand[],
  backward: TransitionCommand[],
): void {
  const color = before.activeColor
  const rank = color === 'w' ? '1' : '8'

  const kingFrom: Square = 'e' + rank
  const kingTo:   Square = side === 'K' ? 'g' + rank : 'c' + rank
  const rookFrom: Square = side === 'K' ? 'h' + rank : 'a' + rank
  const rookTo:   Square = side === 'K' ? 'f' + rank : 'd' + rank

  const king = boardGet(before.board, kingFrom)!
  const rook = boardGet(before.board, rookFrom)!

  forward.push({ op: 'move', pieceId: king.id, from: kingFrom, to: kingTo })
  forward.push({ op: 'move', pieceId: rook.id, from: rookFrom, to: rookTo })
  backward.push({ op: 'move', pieceId: king.id, from: kingTo, to: kingFrom })
  backward.push({ op: 'move', pieceId: rook.id, from: rookTo, to: rookFrom })
}

// ── GamePlayer: navigate via transitions ──────────────────────────────────────

export class GamePlayer {
  readonly transitions: Transition[]
  readonly initialState: GameState
  private _state: GameState
  private _halfmove: number = 0

  constructor(result: BuildResult) {
    this.transitions = result.transitions
    this.initialState = result.initialState
    this._state = result.initialState
  }

  get halfmove(): number { return this._halfmove }
  get totalMoves(): number { return this.transitions.length }
  get currentSAN(): string | null {
    return this._halfmove > 0 ? (this.transitions[this._halfmove - 1]?.san ?? null) : null
  }
  get currentAnnotation(): string | undefined {
    return this._halfmove > 0
      ? this.transitions[this._halfmove - 1]?.annotation
      : this.transitions[0]?.annotation  // pre-game annotation
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

  /**
   * Jump directly to a half-move without returning intermediate transition commands.
   * The renderer should call `render(stateAt(n))` after this.
   */
  jumpTo(n: number): void {
    this._halfmove = Math.max(0, Math.min(n, this.transitions.length))
  }

  /**
   * Compute the board state at half-move `n` by replaying moves from the initial state.
   * Used by `jumpTo` so the renderer can do a full re-render without animating each step.
   */
  stateAt(n: number): GameState {
    let s = this.initialState
    const limit = Math.min(n, this.transitions.length)
    for (let i = 0; i < limit; i++) {
      const san = this.transitions[i]!.san
      const result = applyMove(s, san)
      if (result) s = result.state
    }
    return s
  }
}
