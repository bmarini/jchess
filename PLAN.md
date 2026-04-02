# jChess Rewrite Plan

## Goals

1. Keep what works: the transition-list architecture, the chess-viewer UX
2. Fix correctness: a proper PGN parser, real chess rules for source-finding
3. Modern stack: TypeScript, Vite, no jQuery, CSS instead of GIF/sprite hacks
4. Testable: pure functions for parsing and move logic

---

## Current State Summary

**jChess** is a ~750-line, 2008-era jQuery plugin with no build system, no tests, and no
dependencies beyond vendored jQuery 1.7. The core design is clever — an 8×8 board array,
pre-computed forward/backward transition lists for O(1) step navigation, CSS sprites for
pieces — but it has real problems:

- `eval()` for JSON parsing (XSS vector)
- Fragile PGN body-detection regex that fails on many valid first moves (`1.a3`, `1.a4`,
  `1.b4`, `1.f4`, `1.h4`, `1.Na3`, `1.Nc3`, etc.)
- No support for PGN variations `(...)`
- En passant / castling rights not properly tracked during parsing
- O(n) animated `transitionTo` (jumping to move 127 animates all 127 intermediate moves)
- Implicit global variable leaks, `var` hoisting confusion
- Zero tests
- No build pipeline

---

## Target File Structure

```
src/
  types.ts          # Shared TypeScript types
  board.ts          # Board data model (8×8 array, FEN parsing)
  pgn.ts            # PGN tokenizer and parser
  moves.ts          # Move source-finding, piece vectors
  transitions.ts    # Transition-list builder and player
  renderer.ts       # DOM renderer (vanilla JS, CSS transitions)
  chess.ts          # Main public API / entry point
src/tests/
  board.test.ts
  pgn.test.ts
  moves.test.ts
  transitions.test.ts
examples/
  fischer-spassky.pgn
  justdoeet.pgn
  with-queening.pgn
  unambiguous-knight.pgn
  heavily-annotated.pgn
  middle-game.pgn
index.html          # Demo page (rewritten)
package.json
vite.config.ts
tsconfig.json
```

---

## Phase 1 — Project Scaffolding

Set up a modern build environment:

- **Vite** as build/dev tool (zero-config, fast, outputs a single JS bundle)
- **TypeScript** for the whole project
- **Vitest** for unit tests (co-located with Vite, same config)
- **No UI framework** — the library stays a plain JS module; demo page is plain HTML

### package.json scripts
```
dev       → vite (dev server for demo page)
build     → vite build (produces dist/)
test      → vitest run
test:watch → vitest
```

---

## Phase 2 — Types (`src/types.ts`)

Replace stringly-typed values with proper TypeScript types:

```typescript
type Color = 'w' | 'b'
type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
type Square = string  // 'a1'–'h8'

type Piece = {
  color: Color
  type: PieceType
  id: number
}

type Board = (Piece | null)[][]  // [rank][file], rank 0 = rank 8

type GameState = {
  board: Board
  activeColor: Color
  castlingRights: { K: boolean; Q: boolean; k: boolean; q: boolean }
  enPassantSquare: Square | null
  halfmoveClock: number
  fullmoveNumber: number
}

type Vector = { x: number; y: number; limit: number }

type TransitionCommand =
  | { op: 'move'; pieceId: number; from: Square; to: Square }
  | { op: 'remove'; pieceId: number; piece: Piece; square: Square }
  | { op: 'add'; pieceId: number; piece: Piece; square: Square }

type Transition = {
  forward: TransitionCommand[]
  backward: TransitionCommand[]
  san: string
  annotation?: string
}
```

---

## Phase 3 — Board Model (`src/board.ts`)

Clean rewrite of `parseFEN` and board utilities. All pure functions, no mutation.

Key functions:
- `parseFEN(fen: string): GameState` — replaces the existing fragile version
- `boardGet(board: Board, sq: Square): Piece | null`
- `boardSet(board: Board, sq: Square, piece: Piece | null): Board` — returns new board (immutable)
- `cloneBoard(board: Board): Board`
- `algebraicToCoord(sq: Square): [number, number]`
- `coordToAlgebraic(row: number, col: number): Square`

Tests: FEN round-trips, known positions, edge cases (empty ranks, en passant squares).

---

## Phase 4 — PGN Parser (`src/pgn.ts`)

Replace the regex-based parser with a proper tokenizer. This is the most important
correctness fix.

### Tokenizer

Produces a flat list of typed tokens from raw PGN text:

```typescript
type Token =
  | { type: 'move'; san: string }
  | { type: 'annotation'; text: string }
  | { type: 'variation_start' }
  | { type: 'variation_end' }
  | { type: 'nag'; code: number }          // $1, $2, etc.
  | { type: 'result'; value: string }       // 1-0, 0-1, 1/2-1/2, *
  | { type: 'header'; key: string; value: string }
```

### Parser

Walks the token list and produces:

```typescript
type ParsedGame = {
  headers: Record<string, string>
  moves: string[]           // SAN strings in order
  annotations: (string | undefined)[]  // indexed by half-move
}
```

### Key improvements over old parser

- No hardcoded first-move regex — body starts after the last `]` header
- No `eval()` — annotations are plain strings (JSON.parse if the caller needs it)
- Variations `(...)` parsed and skipped without crashing
- Result tokens consumed cleanly
- Handles missing space between move number and move (e.g. `7. Nf3{annotation}`)

### Tests

Parse each of the 9 demo games and assert:
- Correct move count
- Correct headers
- Correct annotations at specific half-moves
- Edge cases: `1.a4`, `1.h4`, `1.Na3`, game with queening, unambiguous knight move

---

## Phase 5 — Move Source-Finding (`src/moves.ts`)

Rewrite `findMoveSource` and related logic as pure functions. Takes a board + move
description, returns the source square.

```typescript
type MoveDescription = {
  pieceType: PieceType
  srcFile?: string   // disambiguation hint
  srcRank?: string   // disambiguation hint
  dstSquare: Square
  color: Color
}

function findMoveSource(board: Board, move: MoveDescription): Square | null
function findPawnMoveSource(board: Board, dstFile: string, dstRank: string, color: Color): Square | null
```

### Key improvements

- Returns `null` (not crashes) when source can't be found — surface as a parse warning
- Pin detection logic preserved but refactored to be readable
- `PIECE_VECTORS` exported as a constant (was buried in the prototype)

### Tests

- Disambiguation: two rooks on same file/rank
- En passant capture
- Castling both sides
- Promotion
- Pinned piece cannot be the source

---

## Phase 6 — Transition System (`src/transitions.ts`)

Keep the core architecture (pre-compute all forward/backward operations during parse),
but type it properly and fix the animated `transitionTo` problem.

```typescript
function buildTransitions(pgn: ParsedGame, initialState: GameState): {
  transitions: Transition[]
  warnings: string[]   // moves that couldn't be parsed
}

function applyTransitionForward(state: GameState, t: Transition): GameState
function applyTransitionBackward(state: GameState, t: Transition): GameState
```

The renderer will use `jumpTo(n)` which applies all transitions 0→n to DOM state
directly without animating intermediate steps. Single-step navigation still animates.

---

## Phase 7 — Renderer (`src/renderer.ts`)

Replace jQuery with vanilla DOM APIs. CSS transitions instead of jQuery `.animate()`.

### Board rendering

Replace `bw-board.gif` with CSS — 64 square divs in an 8×8 grid, colored with
`:nth-child` or explicit classes. Fully responsive via CSS `aspect-ratio`.

### Piece rendering

Replace `acmaster.gif` sprite sheet with Unicode chess symbols (♙♟♘♞♗♝♖♜♕♛♔♚).
Scalable, no image dependency, crisp at any size. Positioned absolutely over the grid
squares. CSS `transition: transform` for smooth movement animation.

### API

```typescript
class Renderer {
  constructor(container: HTMLElement)
  render(board: Board): void          // initial render, no animation
  applyTransition(t: Transition, direction: 'forward' | 'backward'): Promise<void>
  flip(): void
}
```

---

## Phase 8 — Public API (`src/chess.ts`)

Replace the jQuery plugin with a plain ES module class:

```typescript
export class ChessViewer {
  constructor(container: HTMLElement, options: ChessViewerOptions)
  loadPGN(pgn: string): void
  next(): void
  prev(): void
  jumpTo(halfmove: number): void   // no intermediate animations
  flip(): void
  getCurrentMove(): string | null
  getAnnotation(): string | undefined
  getTotalMoves(): number
  on(event: 'move', handler: (san: string, halfmove: number) => void): void
}

type ChessViewerOptions = {
  pgn?: string
  fen?: string       // overrides default start position
}
```

No jQuery required. Embeddable without any framework. The demo page just does:

```javascript
import { ChessViewer } from './src/chess.ts'
const viewer = new ChessViewer(document.getElementById('board'), { pgn })
```

---

## Phase 9 — Demo Page (`index.html`)

Rewrite `index.html` and the demo wiring. Preserve all 9 demo games (extract PGNs to
`examples/*.pgn`). Load PGNs via fetch in the demo page.

---

## What to Keep vs. Discard

| Current element             | Decision                                              |
|-----------------------------|-------------------------------------------------------|
| Transition list architecture| **Keep** — elegant design, O(1) step navigation      |
| FEN parser                  | **Rewrite** — clean pure function                     |
| PGN parser                  | **Rewrite** — fix correctness, proper tokenizer       |
| `findMoveSource` logic      | **Rewrite** — pure functions, fix en passant          |
| jQuery `.animate()`         | **Replace** — CSS transitions                         |
| GIF board + sprite sheet    | **Replace** — CSS grid + Unicode pieces               |
| jQuery plugin API           | **Replace** — plain ES module class                   |
| Demo games (9 PGNs)         | **Keep** — move to `examples/`                        |
| `eval()`                    | **Delete**                                            |

---

## Suggested Implementation Order

1. [ ] Phase 1: Scaffold Vite + TypeScript + Vitest project
2. [ ] Phase 2: `src/types.ts`
3. [ ] Phase 3: `src/board.ts` with FEN parsing and tests
4. [ ] Phase 4: `src/pgn.ts` tokenizer with tests against all 9 demo games
5. [ ] Phase 5: `src/moves.ts` source-finding with tests for edge cases
6. [ ] Phase 6: `src/transitions.ts` with navigation tests
7. [ ] Phase 7: `src/renderer.ts` with CSS board + Unicode pieces
8. [ ] Phase 8: `src/chess.ts` public API
9. [ ] Phase 9: Rewrite `index.html` demo page
