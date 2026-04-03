'use client'

import Image from 'next/image'
import type { Position } from '@chess/board'
import type { TransitionCommand } from '@chess/types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

type Props = {
  position: Position | null
  flipped?: boolean
  lastCommands?: TransitionCommand[]
  pieceBase?: string
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

export default function Board({
  position,
  flipped = false,
  lastCommands,
  pieceBase = '/pieces/mpchess/',
}: Props) {
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
            {ranks.map(rank =>
              files.map(file => {
                const square = file + rank
                const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
                const isHighlighted = highlightedSquares.has(square)
                const piece = position?.get(square)
                const src = piece ? `${pieceBase}${piece.color}${piece.type}.svg` : null

                return (
                  <div
                    key={square}
                    className={[
                      'relative aspect-square',
                      isHighlighted
                        ? isLight ? 'bg-yellow-200' : 'bg-yellow-500'
                        : isLight ? 'bg-amber-100' : 'bg-amber-800',
                    ].join(' ')}
                  >
                    {src && (
                      <Image
                        src={src}
                        alt={`${piece!.color}${piece!.type}`}
                        fill
                        className="p-[6%] drop-shadow-sm"
                        draggable={false}
                      />
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
