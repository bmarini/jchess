'use client'

import { useEffect, useRef } from 'react'
import { coordToSquare } from '@chess/board'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
import type { Position } from '@chess/board'
import type { Piece, TransitionCommand } from '@chess/types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

type Props = {
  position: Position | null
  flipped?: boolean
  lastCommands?: TransitionCommand[]
  pieceBase?: string
}

type PieceOnBoard = { id: number; piece: Piece; square: string }

function getPieces(position: Position): PieceOnBoard[] {
  const result: PieceOnBoard[] = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = position.board[row]?.[col]
      if (piece) result.push({ id: piece.id, piece, square: coordToSquare(row, col) })
    }
  }
  return result
}

/** Convert algebraic square to [col%, top%] for absolute positioning on an 8×8 grid. */
function squareToXY(square: string, flipped: boolean): { left: string; top: string } {
  const col = square.charCodeAt(0) - 97          // 'a'=0 … 'h'=7
  const rank = parseInt(square[1]!) - 1           // '1'=0 … '8'=7
  const row = 7 - rank                            // rank 8 → row 0

  const displayCol = flipped ? 7 - col : col
  const displayRow = flipped ? 7 - row : row

  return { left: `${displayCol * 12.5}%`, top: `${displayRow * 12.5}%` }
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
  pieceBase = `${BASE_PATH}/pieces/mpchess/`,
}: Props) {
  const highlightedSquares = getLastMoveSquares(lastCommands)
  const pieces = position ? getPieces(position) : []

  const files = flipped ? [...FILES].reverse() : FILES
  const ranks = flipped ? [...RANKS].reverse() : RANKS

  // Suppress transition when flipping the board (otherwise pieces slide across)
  const prevFlippedRef = useRef(flipped)
  const suppressTransitionRef = useRef(false)
  if (prevFlippedRef.current !== flipped) {
    suppressTransitionRef.current = true
    prevFlippedRef.current = flipped
  }
  useEffect(() => {
    if (suppressTransitionRef.current) {
      suppressTransitionRef.current = false
    }
  })

  return (
    <div className="relative select-none">
      <div className="flex">
        {/* Rank labels */}
        <div
          className="flex flex-col justify-around pr-1 text-xs text-neutral-500 font-mono"
          style={{ width: '1.2rem' }}
        >
          {ranks.map(r => (
            <div
              key={r}
              className="flex items-center justify-center"
              style={{ height: '12.5%', aspectRatio: '1' }}
            >
              {r}
            </div>
          ))}
        </div>

        <div className="flex flex-col flex-1">
          {/* Board: square-colored grid + absolutely-positioned pieces */}
          <div className="relative w-full aspect-square border border-neutral-300 rounded shadow-md overflow-hidden">
            {/* 8×8 colored squares — background layer */}
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: 'repeat(8, 1fr)',
                gridTemplateRows: 'repeat(8, 1fr)',
              }}
            >
              {ranks.map(rank =>
                files.map(file => {
                  const square = file + rank
                  const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0
                  const isHighlighted = highlightedSquares.has(square)
                  return (
                    <div
                      key={square}
                      className={
                        isHighlighted
                          ? isLight ? 'bg-yellow-200' : 'bg-yellow-500'
                          : isLight ? 'bg-amber-100' : 'bg-amber-800'
                      }
                    />
                  )
                })
              )}
            </div>

            {/* Pieces — absolutely positioned, animated via CSS transition */}
            {pieces.map(({ id, piece, square }) => {
              const { left, top } = squareToXY(square, flipped)
              return (
                <div
                  key={id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width: '12.5%',
                    height: '12.5%',
                    transition: suppressTransitionRef.current
                      ? 'none'
                      : 'left 150ms ease, top 150ms ease',
                    willChange: 'left, top',
                  }}
                >
                  {/* Plain img — SVGs need no Next.js optimization, and src is already prefixed */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${pieceBase}${piece.color}${piece.type}.svg`}
                    alt={`${piece.color}${piece.type}`}
                    className="w-full h-full p-[6%] drop-shadow-sm"
                    draggable={false}
                  />
                </div>
              )
            })}
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
