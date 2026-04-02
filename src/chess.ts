import { parseFEN, STARTING_FEN } from './board.js'
import { parsePGN } from './pgn.js'
import { Renderer } from './renderer.js'
import { buildTransitions, GamePlayer } from './transitions.js'
import type { ChessViewerOptions } from './types.js'

export type { ChessViewerOptions } from './types.js'
export type { ParsedGame } from './types.js'
export type { GameState, Board, Piece, Square, Color, PieceType } from './types.js'
export { parsePGN } from './pgn.js'
export { parseFEN, STARTING_FEN } from './board.js'
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
    this.renderer = new Renderer(container)

    const fenStr = options.fen ?? STARTING_FEN
    const initialState = parseFEN(fenStr)

    if (options.pgn) {
      const game = parsePGN(options.pgn)
      const result = buildTransitions(game, initialState)
      if (result.warnings.length > 0) {
        console.warn('[jchess] Move parse warnings:', result.warnings)
      }
      this.player = new GamePlayer(result)
      this.renderer.render(result.initialState)
    } else {
      this.renderer.render(initialState)
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
    const state = this.player.stateAt(halfmove)
    this.renderer.render(state)
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
    const fenStr = fen ?? STARTING_FEN
    const initialState = parseFEN(fenStr)
    const game = parsePGN(pgn)
    const result = buildTransitions(game, initialState)
    if (result.warnings.length > 0) {
      console.warn('[jchess] Move parse warnings:', result.warnings)
    }
    this.player = new GamePlayer(result)
    this.renderer.render(result.initialState)
  }
}
