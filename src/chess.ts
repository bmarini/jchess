import { Position, STARTING_FEN } from './board.js'
import { parsePGN } from './pgn.js'
import { Renderer } from './renderer.js'
import { buildTransitions, GamePlayer } from './transitions.js'
import type { ChessViewerOptions, Transition } from './types.js'

export type { ChessViewerOptions } from './types.js'
export type { ParsedGame, ParsedMove, Transition } from './types.js'
export type { Board, Piece, Square, Color, PieceType, CastlingRights } from './types.js'
export { parsePGN } from './pgn.js'
export { Position, STARTING_FEN } from './board.js'
export { buildTransitions, GamePlayer } from './transitions.js'

type MoveEventHandler = (san: string, halfmove: number) => void

/**
 * ChessViewer — wire a DOM element up to a chess game.
 *
 * @example
 * ```html
 * <div id="board" style="--jchess-size: 480px"></div>
 * ```
 * ```ts
 * import { ChessViewer } from './src/chess.ts'
 * const viewer = new ChessViewer(document.getElementById('board')!, { pgn })
 * ```
 */
export class ChessViewer {
  private renderer: Renderer
  private player: GamePlayer | null = null
  private moveHandlers: MoveEventHandler[] = []
  private animateSteps: boolean = true

  constructor(container: HTMLElement, options: ChessViewerOptions = {}) {
    this.renderer = new Renderer(container, options.pieceBase)

    const initial = options.fen ? Position.fromFEN(options.fen) : Position.starting()

    if (options.pgn) {
      const result = buildTransitions(parsePGN(options.pgn), initial)
      if (result.warnings.length > 0) {
        console.warn('[jchess] Move parse warnings:', result.warnings)
      }
      this.player = new GamePlayer(result)
      this.renderer.render(result.initialPosition)
    } else {
      this.renderer.render(initial)
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  next(): void {
    if (!this.player) return
    const cmds = this.player.stepForward()
    if (!cmds) return
    this.renderer.applyCommands(cmds, this.animateSteps)
    this.emit()
  }

  prev(): void {
    if (!this.player) return
    const cmds = this.player.stepBackward()
    if (!cmds) return
    this.renderer.applyCommands(cmds, this.animateSteps)
    this.emit()
  }

  /**
   * Jump directly to a half-move number without animating intermediate steps.
   * The board re-renders instantly from the computed position.
   */
  jumpTo(halfmove: number): void {
    if (!this.player) return
    this.player.jumpTo(halfmove)
    this.renderer.render(this.player.positionAt(halfmove))
    this.emit()
  }

  flip(): void {
    this.renderer.flip()
  }

  // ── State accessors ─────────────────────────────────────────────────────────

  getCurrentMove(): string | null {
    return this.player?.currentSAN ?? null
  }

  getAnnotation(): string | undefined {
    return this.player?.currentAnnotation
  }

  getHalfmove(): number {
    return this.player?.halfmove ?? 0
  }

  getTotalMoves(): number {
    return this.player?.totalMoves ?? 0
  }

  getMoves(): string[] {
    return this.player?.transitions.map(t => t.san) ?? []
  }

  /** Returns the main-line transitions (with embedded .variations for the move list). */
  getTransitions(): Transition[] {
    return this.player?.transitions ?? []
  }

  enterVariation(variationIndex: number): void {
    if (!this.player) return
    const pos = this.player.enterVariation(variationIndex)
    this.renderer.render(pos)
    this.emit()
  }

  exitVariation(): void {
    if (!this.player) return
    const pos = this.player.exitVariation()
    this.renderer.render(pos)
    this.emit()
  }

  get isInVariation(): boolean {
    return this.player?.isInVariation ?? false
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  on(event: 'move', handler: MoveEventHandler): this {
    if (event === 'move') this.moveHandlers.push(handler)
    return this
  }

  off(event: 'move', handler: MoveEventHandler): this {
    if (event === 'move') {
      this.moveHandlers = this.moveHandlers.filter(h => h !== handler)
    }
    return this
  }

  private emit(): void {
    const san = this.getCurrentMove() ?? ''
    const halfmove = this.getHalfmove()
    for (const h of this.moveHandlers) h(san, halfmove)
  }

  // ── Reload ──────────────────────────────────────────────────────────────────

  loadPGN(pgn: string, fen?: string): void {
    const initial = fen ? Position.fromFEN(fen) : Position.starting()
    const result = buildTransitions(parsePGN(pgn), initial)
    if (result.warnings.length > 0) {
      console.warn('[jchess] Move parse warnings:', result.warnings)
    }
    this.player = new GamePlayer(result)
    this.renderer.render(result.initialPosition)
  }
}
