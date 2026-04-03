'use client'

import type { Position } from '@chess/board'
import type { TransitionCommand } from '@chess/types'

const PIECE_GLYPHS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

type Props = {
  position: Position | null
  flipped?: boolean
  lastCommands?: TransitionCommand[]
}

function getLastMoveSquares(commands: TransitionCommand[] | undefined): Set<string> {
  const squares = new Set<string>()
  if (!commands) return squares
  for (const cmd of commands) {
    if (cmd.op === 'move') { squares.add(cmd.from); squares.add(cmd.to) }
    if (cmd.op === 'add')  { squares.add(cmd.square) }
  }
  return squares
}

export default function Board({ position, flipped = false, lastCommands }: Props) {
  const highlightedSquares = getLastMoveSquares(lastCommands)

  const files = flipped ? [...FILES].reverse() : FILES
  const ranks = flipped ? [...RANKS].reverse() : RANKS

  return (
    <div className="relative select-none">
      <div className="flex">
        {/* Rank labels */}
        <div className="flex flex-col justify-around pr-1 text-xs text-neutral-500 font-mono" style={{ width: '1.2rem' }}>
          {ranks.map(r => (
            <div key={r} className="flex items-center justify-center" style={{ height: '12.5%', aspectRatio: '1' }}>
              {r}
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1">
          {/* Board grid */}
          <div
            className="grid border border-neutral-300 rounded shadow-md overflow-hidden"
            style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}
          >
            {ranks.map((rank, ri) =>
              files.map((file, fi) => {
                const square = file + rank
                const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
                const isHighlighted = highlightedSquares.has(square)
                const piece = position?.get(square)

                return (
                  <div
                    key={square}
                    className={[
                      'flex items-center justify-center aspect-square',
                      isHighlighted
                        ? isLight ? 'bg-yellow-200' : 'bg-yellow-500'
                        : isLight ? 'bg-amber-100' : 'bg-amber-800',
                    ].join(' ')}
                  >
                    {piece && (
                      <span
                        className={[
                          'text-3xl leading-none cursor-default',
                          piece.color === 'w' ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]' : 'text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]',
                        ].join(' ')}
                        style={{ fontSize: 'min(6vw, 2.5rem)' }}
                      >
                        {PIECE_GLYPHS[piece.color + piece.type] ?? '?'}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* File labels */}
          <div className="flex text-xs text-neutral-500 font-mono mt-0.5">
            {files.map(f => (
              <div key={f} className="flex-1 text-center">{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
