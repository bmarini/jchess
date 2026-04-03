import { coordToSquare, Position, squareToCoord } from './board.js'
import type { Color, Piece, PieceType, Square, TransitionCommand } from './types.js'

// ── Unicode piece glyphs ──────────────────────────────────────────────────────

const GLYPHS: Record<Color, Record<PieceType, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}

// ── CSS injected once ─────────────────────────────────────────────────────────

const CSS = `
.jchess-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: var(--jchess-size, 400px);
  height: var(--jchess-size, 400px);
  user-select: none;
}
.jchess-square {
  position: relative;
}
.jchess-square.light { background: var(--jchess-light, #f0d9b5); }
.jchess-square.dark  { background: var(--jchess-dark,  #b58863); }
.jchess-square.last-move { outline: 3px solid rgba(20,85,30,0.5); outline-offset: -3px; }
.jchess-piece {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--jchess-size, 400px) / 9);
  line-height: 1;
  cursor: default;
  pointer-events: none;
}
.jchess-piece.white {
  color: #fff;
  -webkit-text-stroke: 1.2px #333;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}
.jchess-piece.black {
  color: #1a1a1a;
  -webkit-text-stroke: 0.5px rgba(255,255,255,0.3);
  text-shadow: 0 1px 3px rgba(255,255,255,0.25);
}
.jchess-piece.animating {
  transition: transform var(--jchess-anim, 120ms) ease;
  z-index: 100;
}
.jchess-coords {
  position: absolute;
  font-size: calc(var(--jchess-size, 400px) / 32);
  font-family: sans-serif;
  font-weight: bold;
  line-height: 1;
  pointer-events: none;
}
.jchess-square.light .jchess-coords { color: var(--jchess-dark,  #b58863); }
.jchess-square.dark  .jchess-coords { color: var(--jchess-light, #f0d9b5); }
.jchess-coord-rank { bottom: 2px; left: 3px; }
.jchess-coord-file { top: 2px; right: 3px; }
`

let cssInjected = false
function injectCSS(): void {
  if (cssInjected) return
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
  cssInjected = true
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export class Renderer {
  private container: HTMLElement
  private boardEl: HTMLElement
  private squares: HTMLElement[] = []  // indexed [row * 8 + col]
  private pieces: Map<number, HTMLElement> = new Map()  // pieceId → element
  private pieceSquares: Map<number, Square> = new Map() // pieceId → square name
  private flipped: boolean = false

  constructor(container: HTMLElement) {
    injectCSS()
    this.container = container
    this.container.innerHTML = ''

    this.boardEl = document.createElement('div')
    this.boardEl.className = 'jchess-board'
    this.container.appendChild(this.boardEl)

    this.buildSquares()
  }

  private buildSquares(): void {
    this.boardEl.innerHTML = ''
    this.squares = []

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = document.createElement('div')
        const isLight = (row + col) % 2 === 0
        sq.className = `jchess-square ${isLight ? 'light' : 'dark'}`
        this.boardEl.appendChild(sq)
        this.squares.push(sq)
      }
    }
    this.addCoordLabels()
  }

  private addCoordLabels(): void {
    const files = 'abcdefgh'
    const ranks = '87654321'

    for (let i = 0; i < 8; i++) {
      // Rank label on the left edge of each row (col 0)
      const rankLabel = document.createElement('span')
      rankLabel.className = 'jchess-coords jchess-coord-rank'
      rankLabel.textContent = this.flipped ? String(i + 1) : ranks[i]!
      this.squareEl(i, 0).appendChild(rankLabel)

      // File label on the bottom edge of each column (row 7)
      const fileLabel = document.createElement('span')
      fileLabel.className = 'jchess-coords jchess-coord-file'
      fileLabel.textContent = this.flipped ? files[7 - i]! : files[i]!
      this.squareEl(7, i).appendChild(fileLabel)
    }
  }

  private squareEl(row: number, col: number): HTMLElement {
    const r = this.flipped ? 7 - row : row
    const c = this.flipped ? 7 - col : col
    return this.squares[r * 8 + c]!
  }

  private squareElByName(sq: Square): HTMLElement {
    const [row, col] = squareToCoord(sq)
    return this.squareEl(row, col)
  }

  /** Full render of a position. No animations. */
  render(position: Position): void {
    this.clearPieces()
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = position.board[row]?.[col]
        if (piece) this.placePiece(piece, coordToSquare(row, col))
      }
    }
  }

  private clearPieces(): void {
    this.pieces.forEach(el => el.remove())
    this.pieces.clear()
    this.pieceSquares.clear()
  }

  private placePiece(piece: Piece, sq: Square): void {
    const el = this.createPieceEl(piece)
    this.squareElByName(sq).appendChild(el)
    this.pieces.set(piece.id, el)
    this.pieceSquares.set(piece.id, sq)
  }

  private createPieceEl(piece: Piece): HTMLElement {
    const el = document.createElement('div')
    el.className = `jchess-piece ${piece.color === 'w' ? 'white' : 'black'}`
    el.dataset['pieceId'] = String(piece.id)
    el.textContent = GLYPHS[piece.color][piece.type]
    return el
  }

  /** Apply a list of transition commands. Returns a promise that resolves when all animations complete. */
  applyCommands(commands: TransitionCommand[], animate: boolean): Promise<void> {
    // Clear last-move highlights
    this.squares.forEach(sq => sq.classList.remove('last-move'))

    const animations: Promise<void>[] = []

    for (const cmd of commands) {
      switch (cmd.op) {
        case 'add': {
          const el = this.createPieceEl(cmd.piece)
          this.squareElByName(cmd.square).appendChild(el)
          this.pieces.set(cmd.pieceId, el)
          this.pieceSquares.set(cmd.pieceId, cmd.square)
          break
        }
        case 'remove': {
          const el = this.pieces.get(cmd.pieceId)
          if (el) { el.remove(); this.pieces.delete(cmd.pieceId); this.pieceSquares.delete(cmd.pieceId) }
          break
        }
        case 'move': {
          const el = this.pieces.get(cmd.pieceId)
          if (!el) break
          if (animate) {
            animations.push(this.animateMove(el, cmd.from, cmd.to))
          } else {
            this.squareElByName(cmd.to).appendChild(el)
          }
          this.pieceSquares.set(cmd.pieceId, cmd.to)
          // Highlight destination square
          this.squareElByName(cmd.to).classList.add('last-move')
          break
        }
      }
    }

    return Promise.all(animations).then(() => undefined)
  }

  private animateMove(el: HTMLElement, _from: Square, to: Square): Promise<void> {
    return new Promise(resolve => {
      // FLIP technique: First → Last → Invert → Play
      // 1. Capture where the piece currently renders (First)
      const fromRect = el.getBoundingClientRect()

      // 2. Move element to destination in the DOM (Last)
      this.squareElByName(to).appendChild(el)
      const toRect = el.getBoundingClientRect()

      // 3. Calculate the offset that makes it appear at its old position (Invert)
      const dx = fromRect.left - toRect.left
      const dy = fromRect.top  - toRect.top

      if (dx === 0 && dy === 0) { resolve(); return }

      // Apply the inverted transform instantly (no transition class yet)
      el.style.transform = `translate(${dx}px, ${dy}px)`

      // Force reflow so the browser registers the starting transform
      el.getBoundingClientRect()

      // 4. Add transition class and animate to transform: none (Play)
      el.classList.add('animating')
      el.style.transform = 'translate(0, 0)'

      const onEnd = () => {
        el.classList.remove('animating')
        el.style.transform = ''
        resolve()
      }
      el.addEventListener('transitionend', onEnd, { once: true })
      // Fallback in case transitionend doesn't fire (hidden tab, zero duration)
      setTimeout(onEnd, 400)
    })
  }

  flip(): void {
    this.flipped = !this.flipped
    const savedPieces = new Map(this.pieces)
    const savedSquares = new Map(this.pieceSquares)
    this.buildSquares()
    this.pieces.clear()
    this.pieceSquares.clear()

    savedPieces.forEach((el, id) => {
      const sq = savedSquares.get(id)
      if (sq) {
        this.squareElByName(sq).appendChild(el)
        this.pieces.set(id, el)
        this.pieceSquares.set(id, sq)
      }
    })
  }

  get isFlipped(): boolean { return this.flipped }
}
