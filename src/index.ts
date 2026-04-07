// Public API for the jchess package.
//
// Consumers can import from the barrel for convenience:
//   import { Position, parsePGN } from 'jchess'
//
// Or from subpaths for clarity:
//   import { Position } from 'jchess/board'
//   import { parsePGN } from 'jchess/pgn'
//
// Note: chess.ts (the DOM viewer) is intentionally NOT in the barrel.
// Import it explicitly via `jchess/viewer` to opt into the DOM dependency.

export * from './types.js'
export * from './board.js'
export * from './movegen.js'
export * from './pgn.js'
export * from './export.js'
export * from './transitions.js'
export * from './annotation.js'
