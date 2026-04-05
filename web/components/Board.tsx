'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { coordToSquare } from '@chess/board'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
import type { Position } from '@chess/board'
import type { Piece, PieceType, TransitionCommand } from '@chess/types'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']
const PROMO_PIECES: PieceType[] = ['Q', 'R', 'B', 'N']

type Props = {
  position: Position | null
  flipped?: boolean
  lastCommands?: TransitionCommand[]
  pieceBase?: string
  onMove?: (from: string, to: string, promotion?: PieceType) => void
  /** Best move arrow: "from:to" format (e.g., "e2:e4") */
  bestMoveArrow?: string
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

function squareToXY(square: string, flipped: boolean): { left: string; top: string } {
  const col = square.charCodeAt(0) - 97
  const rank = parseInt(square[1]!) - 1
  const row = 7 - rank

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

function isPromotionMove(position: Position, from: string, to: string): boolean {
  const piece = position.get(from)
  if (!piece || piece.type !== 'P') return false
  const targetRank = piece.color === 'w' ? '8' : '1'
  return to[1] === targetRank
}

function squareToCenter(square: string, flipped: boolean): { x: number; y: number } {
  const col = square.charCodeAt(0) - 97
  const rank = parseInt(square[1]!) - 1
  const row = 7 - rank
  const displayCol = flipped ? 7 - col : col
  const displayRow = flipped ? 7 - row : row
  return { x: displayCol * 12.5 + 6.25, y: displayRow * 12.5 + 6.25 }
}

export default function Board({
  position,
  flipped = false,
  lastCommands,
  pieceBase = `${BASE_PATH}/pieces/mpchess/`,
  onMove,
  bestMoveArrow,
}: Props) {
  const highlightedSquares = getLastMoveSquares(lastCommands)
  const pieces = position ? getPieces(position) : []
  const activeColor = position?.activeColor ?? 'w'

  const files = flipped ? [...FILES].reverse() : FILES
  const ranks = flipped ? [...RANKS].reverse() : RANKS

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set())
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null)

  // Clear selection when position changes
  const posRef = useRef(position)
  if (posRef.current !== position) {
    posRef.current = position
    if (selectedSquare) { setSelectedSquare(null); setLegalTargets(new Set()) }
    if (promotionPending) setPromotionPending(null)
  }

  // Suppress transition when flipping the board
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

  const selectPiece = useCallback((square: string) => {
    if (!position) return
    setSelectedSquare(square)
    setLegalTargets(new Set(position.legalMovesFrom(square)))
  }, [position])

  const handleSquareClick = useCallback((square: string) => {
    if (!onMove || !position) return

    if (promotionPending) {
      setPromotionPending(null)
      return
    }

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null)
        setLegalTargets(new Set())
        return
      }

      // Clicking another piece of the same color — switch selection
      const clickedPiece = position.get(square)
      if (clickedPiece && clickedPiece.color === activeColor && !legalTargets.has(square)) {
        selectPiece(square)
        return
      }

      // Only allow moves to legal targets
      if (!legalTargets.has(square)) {
        setSelectedSquare(null)
        setLegalTargets(new Set())
        return
      }

      // Attempt move
      if (isPromotionMove(position, selectedSquare, square)) {
        setPromotionPending({ from: selectedSquare, to: square })
      } else {
        onMove(selectedSquare, square)
        setSelectedSquare(null)
        setLegalTargets(new Set())
      }
    } else {
      const piece = position.get(square)
      if (piece && piece.color === activeColor) {
        selectPiece(square)
      }
    }
  }, [onMove, position, selectedSquare, promotionPending, activeColor, legalTargets, selectPiece])

  const handlePromotion = useCallback((pieceType: PieceType) => {
    if (!promotionPending || !onMove) return
    onMove(promotionPending.from, promotionPending.to, pieceType)
    setPromotionPending(null)
    setSelectedSquare(null)
  }, [promotionPending, onMove])

  return (
    <div className="relative select-none">
      {/* Outer frame */}
      <div className="bg-amber-950 rounded-md shadow-lg overflow-hidden">
        {/* Top file labels */}
        <div className="flex" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {files.map(f => (
            <div key={f} className="flex-1 text-center text-[10px] text-amber-200/70 font-mono leading-5">
              {f}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Left rank labels */}
          <div className="flex flex-col justify-around text-[10px] text-amber-200/70 font-mono" style={{ width: '1.5rem' }}>
            {ranks.map(r => (
              <div key={r} className="flex-1 flex items-center justify-center">{r}</div>
            ))}
          </div>

          {/* Board */}
          <div className="relative flex-1 aspect-square overflow-hidden">
            {/* 8×8 colored squares */}
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
                  const isSelected = square === selectedSquare
                  const isLegalTarget = legalTargets.has(square)
                  const hasOccupant = position?.get(square) !== null
                  return (
                    <div
                      key={square}
                      className={[
                        'relative',
                        isSelected
                          ? 'bg-blue-400/60'
                          : isHighlighted
                            ? isLight ? 'bg-yellow-200' : 'bg-yellow-500'
                            : isLight ? 'bg-amber-100' : 'bg-amber-800',
                      ].join(' ')}
                    >
                      {isLegalTarget && (
                        hasOccupant
                          ? <div className="absolute inset-0 rounded-full border-[3px] border-neutral-900/25 m-[4%]" />
                          : <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-[30%] h-[30%] rounded-full bg-neutral-900/25" />
                            </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Pieces */}
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

            {/* Best move arrow */}
            {bestMoveArrow && (() => {
              const [from, to] = bestMoveArrow.split(':')
              if (!from || !to) return null
              const start = squareToCenter(from, flipped)
              const end = squareToCenter(to, flipped)
              // Build arrow as a single polygon path — no overlap issues
              const dx = end.x - start.x
              const dy = end.y - start.y
              const len = Math.sqrt(dx * dx + dy * dy)
              const ux = dx / len // unit vector along arrow
              const uy = dy / len
              const nx = -uy // normal (perpendicular)
              const ny = ux
              const sw = 1.4 // shaft half-width
              const hw = 3.2 // head half-width
              const headLen = 4.5
              // Points: start-left, base-left, head-left, tip, head-right, base-right, start-right
              const baseX = end.x - ux * headLen
              const baseY = end.y - uy * headLen
              const points = [
                `${start.x + nx * sw},${start.y + ny * sw}`,
                `${baseX + nx * sw},${baseY + ny * sw}`,
                `${baseX + nx * hw},${baseY + ny * hw}`,
                `${end.x},${end.y}`,
                `${baseX - nx * hw},${baseY - ny * hw}`,
                `${baseX - nx * sw},${baseY - ny * sw}`,
                `${start.x - nx * sw},${start.y - ny * sw}`,
              ].join(' ')
              return (
                <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100">
                  <polygon points={points} fill="rgba(34, 197, 94, 0.75)" />
                </svg>
              )
            })()}

            {/* Click targets */}
            {onMove && (
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
                    return (
                      <div
                        key={square}
                        className="cursor-pointer"
                        onClick={() => handleSquareClick(square)}
                      />
                    )
                  })
                )}
              </div>
            )}

            {/* Promotion dialog */}
            {promotionPending && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-2 flex gap-1">
                  {PROMO_PIECES.map(pt => (
                    <button
                      key={pt}
                      onClick={() => handlePromotion(pt)}
                      className="w-14 h-14 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${pieceBase}${activeColor}${pt}.svg`}
                        alt={pt}
                        className="w-full h-full p-1"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right rank labels */}
          <div className="flex flex-col justify-around text-[10px] text-amber-200/70 font-mono" style={{ width: '1.5rem' }}>
            {ranks.map(r => (
              <div key={r} className="flex-1 flex items-center justify-center">{r}</div>
            ))}
          </div>
        </div>

        {/* Bottom file labels */}
        <div className="flex" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {files.map(f => (
            <div key={f} className="flex-1 text-center text-[10px] text-amber-200/70 font-mono leading-5">
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
