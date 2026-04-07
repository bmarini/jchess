# jchess

A TypeScript chess library: PGN parser, move generator, position model, and a navigable game player. Zero runtime dependencies.

**Live demo:** [bmarini.github.io/jchess](https://bmarini.github.io/jchess/)

## Features

- **PGN parser** — handles annotations, NAGs, recursive variations (RAV), and `[%clk]`/`[%eval]` metadata
- **Position model** — FEN parsing, move application, en passant, castling, promotion, check detection
- **SAN ↔ coordinates** — `toSAN()` for board moves, `parseSAN()` for SAN strings, full disambiguation
- **Legal move generation** — `legalMovesFrom()`, pin detection, checkmate/stalemate
- **Game navigation** — `GamePlayer` with forward/backward/jump, variation entry/exit, makeMove
- **PGN export** — round-trip serialization with annotations, variations, and metadata
- **Strict types** — `Square` is a template literal of all 64 valid squares; nothing slips past the type checker
- **Zero dependencies** — pure TypeScript, ~38kB compressed

## Installation

```bash
npm install jchess
```

## Quick start

```ts
import { Position, parsePGN, buildTransitions, GamePlayer } from 'jchess'

// Parse a PGN
const game = parsePGN(`
[White "Fischer"]
[Black "Spassky"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *
`)

// Build a navigable player
const result = buildTransitions(game, Position.starting())
const player = new GamePlayer(result)

// Navigate
player.stepForward()        // play e4
player.stepForward()        // play e5
console.log(player.currentSAN)         // 'e5'
console.log(player.positionAt(2).toFEN())
```

### Apply a move directly

```ts
import { Position } from 'jchess'

const pos = Position.starting()
const after = pos.applyMove('e4')
console.log(after?.position.get('e4'))  // { color: 'w', type: 'P', id: ... }
```

### Check for checkmate

```ts
import { Position } from 'jchess/board'
import { hasAnyLegalMove } from 'jchess/movegen'

// Fool's mate position (black to move, white just played Qh5#)
const pos = Position.fromFEN('rnb1kbnr/pppp1Qpp/8/4p3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 2')
console.log(pos.isInCheck())          // true
console.log(hasAnyLegalMove(pos))     // false → checkmate
```

### Convert board moves to SAN

```ts
import { Position } from 'jchess/board'
import { toSAN } from 'jchess/movegen'

const pos = Position.starting()
console.log(toSAN(pos, 'g1', 'f3'))   // 'Nf3'
console.log(toSAN(pos, 'e2', 'e4'))   // 'e4'
```

### Export back to PGN

```ts
import { parsePGN, buildTransitions, exportPGN, Position } from 'jchess'

const game = parsePGN('1. e4 e5 2. Nf3 Nc6 *')
const { transitions } = buildTransitions(game, Position.starting())
console.log(exportPGN(game.headers, transitions, game.preAnnotation))
```

## Public API

The package is organized into focused modules. Import from the barrel for everything, or from subpaths for clarity:

```ts
// Barrel — everything
import { Position, parsePGN, GamePlayer } from 'jchess'

// Subpaths
import { Position, STARTING_FEN, opponent } from 'jchess/board'
import { toSAN, legalMovesFrom, hasAnyLegalMove } from 'jchess/movegen'
import { parsePGN, tokenize } from 'jchess/pgn'
import { exportPGN } from 'jchess/export'
import { buildTransitions, GamePlayer, Line } from 'jchess/transitions'
import { parseAnnotation, serializeAnnotation, extractNAG } from 'jchess/annotation'
import type { Square, Color, PieceType, Piece, Board, ParsedGame, Transition } from 'jchess/types'
```

| Module | Exports |
|---|---|
| `jchess/board` | `Position`, `STARTING_FEN`, `squareToCoord`, `coordToSquare`, `boardGet`, `boardSet`, `parseSAN`, `findMoveSource`, `opponent`, `toSquare` |
| `jchess/movegen` | `toSAN`, `legalMovesFrom`, `hasAnyLegalMove` |
| `jchess/pgn` | `parsePGN`, `tokenize` |
| `jchess/export` | `exportPGN` |
| `jchess/transitions` | `buildTransitions`, `GamePlayer`, `Line`, `buildSingleTransition` |
| `jchess/annotation` | `parseAnnotation`, `serializeAnnotation`, `extractNAG`, `hasDisplayText` |
| `jchess/types` | `Square`, `Color`, `PieceType`, `Piece`, `Board`, `CastlingRights`, `Transition`, `ParsedGame`, `ParsedMove`, `MoveMetadata` |

### Optional DOM viewer

The package also bundles a vanilla DOM-based viewer (`ChessViewer`) under a separate subpath. React/Vue consumers don't need it; tree-shaking keeps it out of your bundle unless you import it explicitly.

```ts
import { ChessViewer } from 'jchess/viewer'

const viewer = new ChessViewer(document.getElementById('board')!, {
  pgn: '1. e4 e5 2. Nf3 *',
})
viewer.next()
```

## Architecture

### Layered design

```
types.ts        ← shared types (Square, Piece, Board, etc.)
   ↑
board.ts        ← Layer 1: Position class, FEN, applyMove, isInCheck
   ↑
movegen.ts      ← Layer 2: toSAN, legalMovesFrom, hasAnyLegalMove
   ↑
transitions.ts  ← Layer 3: buildTransitions, GamePlayer, Line
```

`pgn.ts`, `export.ts`, and `annotation.ts` are independent modules that work alongside the layers.

### Position is a rich domain object

`Position` owns all move logic and is **immutable** — `applyMove` returns a new `Position`. This makes testing straightforward and lets the transition list pre-compute every position in a game without worrying about shared state.

### Transition list

When a PGN is loaded, `buildTransitions` walks every move and records `{ forward, backward }` command lists per half-move. Single-step navigation replays these in O(1). `GamePlayer` manages a stack of `Line` instances — the main line plus any variations the user has entered.

### Stable piece IDs

Each `Piece` has a stable numeric `id`. This lets a renderer track DOM elements across captures, promotions, and variation switches without re-rendering the whole board. Transitions carry piece IDs, so the renderer always knows which element to move/remove/add.

### Annotation metadata

PGN commands like `[%clk 0:30:00]` and `[%eval +1.5]` are parsed into structured `MoveMetadata` separately from display text. The exporter re-embeds them for round-trip fidelity.

## Coordinate system

- `board[0]` = rank 8 (black's back rank)
- `board[7]` = rank 1 (white's back rank)
- `board[row][col]`, col 0 = a-file, col 7 = h-file
- `squareToCoord('e4')` → `[4, 4]`
- `coordToSquare(4, 4)` → `'e4'`

`Square` is a template literal type — `'a1' | 'a2' | ... | 'h8'`. Constructing a square from string concatenation requires `toSquare(file, rank)` or an explicit cast.

## TypeScript

jchess ships with `.d.ts` files generated from source. Strict mode and `noUncheckedIndexedAccess` are enabled — every public API is fully typed.

## Development

The repo also contains a Next.js demo app (`web/`) that consumes the library directly via path aliases. To work on jchess locally:

```bash
git clone https://github.com/benmarini/jchess
cd jchess
npm install
npm test                # run all 217 tests
npm run build           # build to dist/

# Run the demo
cd web
npm install
npm run dev             # http://localhost:3000
```

The demo includes Stockfish WASM analysis, opening detection, full-game review, bot play, and PGN sharing — see [the live site](https://bmarini.github.io/jchess/) for what's possible on top of jchess.

## License

MIT — see [LICENSE](LICENSE).

The bundled demo additionally uses Stockfish (GPL-3.0), the Lichess chess-openings database (CC0), and Phosphor icons (MIT). These are not part of the npm package.
