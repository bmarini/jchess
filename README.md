# jChess

A chess game viewer. Pass in a PGN string (or FEN position) and get an interactive board with forward/backward navigation, animated piece moves, board-flip, and annotations.

## Quick start

```bash
npm install
npm run dev      # dev server at http://localhost:5173
```

Open `http://localhost:5173` to see the demo page with 9 example games.

## Usage

```html
<div id="board" style="--jchess-size: 480px"></div>
```

```typescript
import { ChessViewer } from './src/chess.ts'

const viewer = new ChessViewer(document.getElementById('board')!, {
  pgn: `[White "Fischer"] [Black "Spassky"] 1. e4 e5 2. Nf3 Nc6 ...`
})

// Navigation
viewer.next()           // step forward one half-move (animated)
viewer.prev()           // step backward one half-move (animated)
viewer.jumpTo(25)       // jump directly to half-move 25 (no intermediate animations)
viewer.flip()           // flip the board

// State
viewer.getCurrentMove()   // → 'Nf3' (SAN of the last applied move)
viewer.getAnnotation()    // → string | undefined
viewer.getHalfmove()      // → current half-move number (0 = start)
viewer.getTotalMoves()    // → total number of half-moves in the game

// Events
viewer.on('move', (san, halfmove) => {
  console.log(`Move ${halfmove}: ${san}`)
})

// Load a new game without recreating the element
viewer.loadPGN(newPgn)
```

### FEN-only (no PGN)

```typescript
const viewer = new ChessViewer(el, {
  fen: 'rq2r1k1/1b3pp1/p3p1n1/1p4BQ/8/7R/PP3PPP/4R1K1 w - - 0 0'
})
```

### Styling

The board size and colors are controlled via CSS custom properties:

| Property | Default | Description |
|---|---|---|
| `--jchess-size` | `400px` | Board width/height |
| `--jchess-light` | `#f0d9b5` | Light square color |
| `--jchess-dark` | `#b58863` | Dark square color |
| `--jchess-anim` | `120ms` | Piece animation duration |

## Development

```bash
npm run dev          # Vite dev server with hot reload
npm test             # Run all tests once
npm run test:watch   # Run tests in watch mode
npm run build        # Build library to dist/
```

## Project structure

```
src/
  types.ts        # Shared TypeScript types
  board.ts        # FEN parser, board data model, coordinate helpers
  pgn.ts          # PGN tokenizer and parser
  moves.ts        # SAN parser, move source-finding, applyMove
  transitions.ts  # Transition-list builder, GamePlayer navigation class
  renderer.ts     # Vanilla DOM renderer — CSS board, Unicode pieces, CSS animations
  chess.ts        # ChessViewer public API (entry point)
  *.test.ts       # Co-located Vitest tests
examples/
  *.pgn           # Example PGN files used by the demo and tests
```

## Architecture

The core design is a **pre-computed transition list**. When a PGN is loaded:

1. `parsePGN` tokenizes the PGN into SAN move strings
2. `buildTransitions` walks the moves, applies each to the board state, and records a `{ forward, backward }` pair of `TransitionCommand[]` for every half-move
3. `GamePlayer` navigates via these transition lists: forward/backward steps execute the pre-computed commands in O(1); `jumpTo(n)` re-renders from the correct computed state without animating intermediate moves

## Legacy version

The original 2008 jQuery version is preserved in `javascripts/jchess-0.1.0.js` for reference.

## Roadmap

### UX

* Goal is for this to not just be a viewer but an editor. I want to take a game, play through it, add annotations, add variations, and then export back to PGN, or via sharable link.
* How to support comments / multiple user annotations? Some type of "rich" annoation?
* Be able to upload a .pgn file with multiple games and show a viewer with game list (searchable too)

### Clean Code

* Rewrite frontend in React, Next.js, and Tailwind (easier for AI driven coding)
* Good separation of concerns between engine and display. Should be easy to build new displays with the underlying engine.
* Go file-by-file and move from purely functional to more idiomatic Typescript (use interfaces, best practices, for example: https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/typescript-best-practices.html)