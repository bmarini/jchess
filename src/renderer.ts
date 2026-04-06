import { coordToSquare, Position, squareToCoord } from './board.js'
import type { Color, Piece, PieceType, Square, TransitionCommand } from './types.js'

// ── Piece image path ──────────────────────────────────────────────────────────

function pieceImageUrl(color: Color, type: PieceType, base: string): string {
  return `${base}${color}${type}.svg`
}

// ── CSS injected once ─────────────────────────────────────────────────────────

const CSS = `
.jchess-outer {
  display: inline-grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr auto;
  user-select: none;
}
.jchess-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: var(--jchess-size, 400px);
  height: var(--jchess-size, 400px);
  grid-column: 2;
  grid-row: 1;
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
  background-size: cover;
  cursor: default;
  pointer-events: none;
}
.jchess-piece.animating {
  transition: transform var(--jchess-anim, 120ms) ease;
  z-index: 100;
}
.jchess-rank-labels {
  display: flex;
  flex-direction: column;
  grid-column: 1;
  grid-row: 1;
}
.jchess-file-labels {
  display: flex;
  flex-direction: row;
  grid-column: 2;
  grid-row: 2;
}
.jchess-coord-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--jchess-size, 400px) / 8);
  height: calc(var(--jchess-size, 400px) / 8);
  font-size: calc(var(--jchess-size, 400px) / 40);
  font-family: sans-serif;
  font-weight: bold;
  color: #888;
  pointer-events: none;
}
.jchess-rank-labels .jchess-coord-label {
  width: calc(var(--jchess-size, 400px) / 20);
}
.jchess-file-labels .jchess-coord-label {
  height: calc(var(--jchess-size, 400px) / 20);
}
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
  private outerEl: HTMLElement
  private boardEl: HTMLElement
  private rankLabelsEl: HTMLElement
  private fileLabelsEl: HTMLElement
  private squares: HTMLElement[] = []  // indexed [row * 8 + col]
  private pieces: Map<number, HTMLElement> = new Map()  // pieceId → element
  private pieceSquares: Map<number, Square> = new Map() // pieceId → square name
  private flipped: boolean = false
  private pieceBase: string

  constructor(container: HTMLElement, pieceBase = './pieces/mpchess/') {
    this.pieceBase = pieceBase
    injectCSS()
    this.container = container
    this.container.innerHTML = ''

    this.outerEl = document.createElement('div')
    this.outerEl.className = 'jchess-outer'
    this.container.appendChild(this.outerEl)

    this.rankLabelsEl = document.createElement('div')
    this.rankLabelsEl.className = 'jchess-rank-labels'
    this.outerEl.appendChild(this.rankLabelsEl)

    this.boardEl = document.createElement('div')
    this.boardEl.className = 'jchess-board'
    this.outerEl.appendChild(this.boardEl)

    this.fileLabelsEl = document.createElement('div')
    this.fileLabelsEl.className = 'jchess-file-labels'
    this.outerEl.appendChild(this.fileLabelsEl)

    this.buildSquares()
  }

  private buildSquares(): void {
    this.boardEl.innerHTML = ''
    this.rankLabelsEl.innerHTML = ''
    this.fileLabelsEl.innerHTML = ''
    this.squares = []

    const ranks = this.flipped ? '12345678' : '87654321'
    const files  = this.flipped ? 'hgfedcba' : 'abcdefgh'

    for (const rank of ranks) {
      const label = document.createElement('span')
      label.className = 'jchess-coord-label'
      label.textContent = rank
      this.rankLabelsEl.appendChild(label)
    }

    for (const file of files) {
      const label = document.createElement('span')
      label.className = 'jchess-coord-label'
      label.textContent = file
      this.fileLabelsEl.appendChild(label)
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = document.createElement('div')
        const isLight = (row + col) % 2 === 0
        sq.className = `jchess-square ${isLight ? 'light' : 'dark'}`
        this.boardEl.appendChild(sq)
        this.squares.push(sq)
      }
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
    el.className = 'jchess-piece'
    el.dataset['pieceId'] = String(piece.id)
    el.style.backgroundImage = `url('${pieceImageUrl(piece.color, piece.type, this.pieceBase)}')`
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
            animations.push(this.animateMove(el, cmd.to))
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

  private animateMove(el: HTMLElement, to: Square): Promise<void> {
    return new Promise(resolve => {
      // FLIP technique: First → Last → Invert → Play
      const fromRect = el.getBoundingClientRect()
      this.squareElByName(to).appendChild(el)
      const toRect = el.getBoundingClientRect()

      const dx = fromRect.left - toRect.left
      const dy = fromRect.top  - toRect.top

      if (dx === 0 && dy === 0) { resolve(); return }

      el.style.transform = `translate(${dx}px, ${dy}px)`
      el.getBoundingClientRect() // force reflow

      el.classList.add('animating')
      el.style.transform = 'translate(0, 0)'

      let done = false
      const onEnd = () => {
        if (done) return
        done = true
        el.classList.remove('animating')
        el.style.transform = ''
        resolve()
      }
      el.addEventListener('transitionend', onEnd, { once: true })
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
