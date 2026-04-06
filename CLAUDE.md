# CLAUDE.md

Context for Claude Code when working in this repository.

## What this project is

jChess is a chess game viewer. It takes PGN-formatted chess games and renders an interactive board. The rewrite (2024) replaced a 2008 jQuery plugin with a modern TypeScript + Vite stack.

## Tech stack

- **TypeScript** — strict mode, `noUncheckedIndexedAccess` enabled
- **Vite** — build tool and dev server
- **Vitest** — tests, co-located as `*.test.ts` beside source files
- No UI framework. No jQuery. No external chess library.

## Commands

```bash
npm run dev          # start dev server (index.html demo)
npm test             # run all tests
npm run test:watch   # watch mode
npm run build        # build to dist/
```

## Source module map

| File | Responsibility |
|---|---|
| `src/types.ts` | All shared types — touch this when adding new data shapes |
| `src/board.ts` | `Position` class (Layer 1: board state), FEN parsing, `applyMove`, `isInCheck`, coordinate helpers, piece vectors, pin detection |
| `src/movegen.ts` | Move generation (Layer 2: SAN translation), `toSAN`, `legalMovesFrom`, `hasAnyLegalMove`. Depends on board.ts only. |
| `src/pgn.ts` | PGN tokenizer + parser. No `eval()`. Handles variations (skips them), annotations, NAGs. |
| `src/export.ts` | PGN exporter — serializes headers, transitions, annotations, and variations back to PGN text |
| `src/transitions.ts` | `buildTransitions` pre-computes forward/backward `TransitionCommand[]` for every half-move. `GamePlayer` navigates them. |
| `src/renderer.ts` | Vanilla DOM. CSS grid board, Unicode piece glyphs, CSS `transition` animations. No jQuery. |
| `src/chess.ts` | `ChessViewer` public API — wires everything together. Entry point for `vite build`. |

## Board coordinate system

- `board[0]` = rank 8 (black's back rank)
- `board[7]` = rank 1 (white's back rank)
- `board[row][col]`, col 0 = a-file, col 7 = h-file
- `squareToCoord('e4')` → `[4, 4]`
- `coordToSquare(4, 4)` → `'e4'`

## Key design decisions

**Transition list architecture**: `buildTransitions` walks all moves at load time and records `{ forward: TransitionCommand[], backward: TransitionCommand[] }` per half-move. Single-step navigation replays these in O(1). `jumpTo(n)` uses `stateAt(n)` to replay moves silently and re-render — no intermediate animation noise.

**Pure functions in moves.ts**: `applyMove` returns a new `GameState` without mutating the input. This makes testing straightforward and is why transition tests can check exact board states.

**Piece IDs**: Each `Piece` has a stable numeric `id`. The renderer stores a `Map<id, HTMLElement>`. Transitions carry piece IDs, so the renderer always knows which DOM element to move/remove/add regardless of promotions or captures.

**En passant**: `applyMove` detects en passant when a pawn captures onto an empty square. The en passant square is maintained in `GameState.enPassantSquare` and updated after every pawn double-advance.

**PGN variations**: The parser tracks `variationDepth`. Moves inside `(...)` are skipped entirely — they don't affect the main line.

## Test coverage

Tests live beside source files as `*.test.ts`. Run with `npm test`.

- `board.test.ts` — FEN parsing, coordinate round-trips, `boardSet` immutability
- `pgn.test.ts` — tokenizer + parser against all 6 example PGNs and edge cases
- `moves.test.ts` — `parseSAN`, `findMoveSource` disambiguation, `applyMove` (castling, en passant, promotion)
- `transitions.test.ts` — `buildTransitions` produces correct commands; `GamePlayer` navigation; zero-warning parsing of all demo games

When adding a new move-handling feature, add a test in `moves.test.ts` first.

## Example PGNs

Live in `examples/*.pgn`. Used by both the test suite and the demo page. Don't rename or move them — tests load them by path via `readFileSync`.

## Common gotchas

- `noUncheckedIndexedAccess` is on — array access always returns `T | undefined`. Use `arr[i]!` when you're certain the index is valid, but add a guard/comment explaining why.
- The renderer is DOM-only and can't be unit tested without jsdom. Keep rendering logic thin and push logic into the pure-function layer (`board.ts`, `moves.ts`, `transitions.ts`).
- `resetPieceIds()` must be called in `beforeEach` in any test that creates boards, otherwise IDs accumulate across tests and expectations on specific IDs will drift.
- `buildTransitions` calls `resetPieceIds()` internally, so IDs assigned during a `buildTransitions` call start from 0. Don't call `resetPieceIds()` while a build is in progress.
