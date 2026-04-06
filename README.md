# jChess

A chess game viewer, annotator, and analysis tool. Load PGN games, review them with Stockfish, add annotations and variations, and play against a bot — all in the browser.

**Live demo:** [bmarini.github.io/jchess](https://bmarini.github.io/jchess/)

## Features

- **Game viewer** — navigate through games with animated piece transitions
- **PGN support** — load, edit, and export PGN files (single or multi-game)
- **Stockfish integration** — WASM engine runs entirely in the browser
  - Live eval bar and principal variation display
  - Full game review with accuracy scores and blunder/mistake/inaccuracy detection
  - Clickable PV line to explore engine suggestions
- **Interactive board** — click pieces to create moves, variations, and new games
  - Legal move indicators (dots on valid squares)
  - Promotion dialog
  - Best move arrows from analysis
- **Annotations** — add text annotations to any move, NAG symbols (?? ? ?! !? ! !!) displayed inline
- **Variations** — create, navigate, and remove recursive variations (RAV)
- **Opening detection** — 3,600+ openings identified automatically from moves (Lichess ECO database)
- **Eval graph** — clickable sparkline showing evaluation across the whole game
- **Play vs bot** — play against Stockfish at adjustable difficulty (Skill Level 0-20)
- **Shareable links** — compress game into URL hash for sharing
- **Local storage** — games persist across sessions
- **Responsive** — mobile layout with horizontal move strip, swipe-friendly controls
- **Clock times** — parse and display `[%clk]` metadata from chess.com PGNs

## Quick start

```bash
# Core library
npm install
npm test             # run all tests

# Web app (Next.js)
cd web
npm install
npm run dev          # dev server at http://localhost:3000
```

## Tech stack

- **Core library** — TypeScript, strict mode, no dependencies
- **Web app** — Next.js (App Router, static export), React, Tailwind CSS v4
- **Engine** — Stockfish 18 WASM (lite-single, 7MB)
- **Tests** — Vitest, co-located as `*.test.ts`
- **Icons** — Phosphor (bold SVG)

## Project structure

```
src/                    Core chess library (no framework dependencies)
  board.ts              Position class, FEN parsing, move logic (applyMove, toSAN, legalMovesFrom, isInCheck)
  pgn.ts                PGN tokenizer + parser
  export.ts             PGN exporter (headers, moves, annotations, variations, metadata)
  transitions.ts        Line class, GamePlayer class, transition builder
  annotation.ts         Parse/serialize annotation metadata ([%clk], [%eval], etc.)
  types.ts              Shared types
  *.test.ts             Co-located tests

web/                    Next.js web application
  app/                  Next.js app router
  components/
    ChessApp.tsx        Main app — state coordinator, renders PlayLayout or ReviewLayout
    PlayLayout.tsx      Bot game mode — board, move strip, resign
    ReviewLayout.tsx    Analysis mode — eval bar, move list, annotations, engine PV
    Board.tsx           Interactive board with piece selection, legal move dots, arrows
    Controls.tsx        Navigation buttons (prev, next, flip)
    MoveList.tsx        Vertical move list with variations, NAG symbols, book markers
    MoveStrip.tsx       Horizontal scrolling move strip (mobile)
    EvalBar.tsx         Vertical/horizontal eval bar (responsive)
    EvalGraph.tsx       Clickable eval sparkline
    GameInfo.tsx        Player names, ELO, accuracy, opening, event info
    BotDialog.tsx       Color + difficulty picker for bot games
    Icon.tsx            SVG icon component
    PGNInput.tsx        PGN paste/file upload
  hooks/
    useChessGame.ts     React wrapper around GamePlayer
    useEngine.ts        Live Stockfish analysis with debounce
    useBotPlayer.ts     Bot move automation + game over detection
  lib/
    engine.ts           StockfishEngine UCI wrapper (Web Worker)
    analyze.ts          Full game analysis (accuracy, NAGs, best moves)
    openings.ts         ECO opening identification (3,663 entries)
    eco.json            Lichess chess-openings database (CC0)
    parseMultiPGN.ts    Multi-game PGN splitter
    shareUrl.ts         Compress/decompress PGN for URL sharing
    storage.ts          localStorage persistence

examples/               Example PGN files (used by tests)
public/
  pieces/mpchess/       SVG piece images
  icons/                Phosphor bold SVG icons
  stockfish/            Stockfish 18 WASM engine files
```

## Architecture

### Transition list

The core design is a **pre-computed transition list**. When a PGN is loaded:

1. `parsePGN` tokenizes the PGN into SAN move strings with annotations and variations
2. `buildTransitions` walks the moves, applies each to the board state via `Position.applyMove`, and records `{ forward, backward }` transition commands per half-move
3. `GamePlayer` navigates via a stack of `Line` instances — the main line plus any entered variations

### Position as domain object

`Position` is a rich domain object (not an anemic data class). It owns all move logic:

- `position.applyMove(san)` — apply a SAN move, return new position
- `position.toSAN(from, to, promotion?)` — convert board coordinates to SAN (with check/checkmate suffixes)
- `position.legalMovesFrom(square)` — all legal destinations for a piece
- `position.isInCheck()` — check detection using raw piece vectors

### Annotation metadata

PGN annotation commands like `[%clk 0:30:00]` and `[%eval +1.5]` are parsed into structured `MoveMetadata` and stored separately from display text. The exporter re-embeds them for round-trip fidelity.

### Play vs Review modes

`ChessApp` is a state coordinator that renders one of two layout components:

- **PlayLayout** — clean board + move strip + resign. For bot games.
- **ReviewLayout** — full analysis experience with eval bar, move list, annotations, engine PV, game actions.

## Commands

```bash
# Core library
npm test                # run all tests
npm run test:watch      # watch mode
npm run build           # build to dist/

# Web app
cd web
npm run dev             # dev server (webpack mode)
npm run build           # static export to web/out/
```

## Deployment

The web app deploys to GitHub Pages via `.github/workflows/deploy.yml`. Push to `master` triggers a build from `web/` and deploys `web/out/` to [bmarini.github.io/jchess](https://bmarini.github.io/jchess/).

## License

Stockfish WASM: GPL-3.0. Lichess chess-openings: CC0. Phosphor Icons: MIT. Piece SVGs: see `public/pieces/`.
