'use client'

import { useMemo } from 'react'
import type { Transition } from '@chess/types'

type Props = {
  transitions: Transition[]
  halfmove: number
  onJump: (n: number) => void
}

function parseEval(evalStr: string | undefined): number | null {
  if (!evalStr) return null
  if (evalStr.startsWith('#')) {
    const mate = parseInt(evalStr.slice(1), 10)
    return mate > 0 ? 10 : -10 // cap mate scores at ±10 pawns
  }
  const n = parseFloat(evalStr)
  return isNaN(n) ? null : n
}

/**
 * Eval graph showing position evaluation across the whole game.
 * Click to jump to a specific move.
 */
export default function EvalGraph({ transitions, halfmove, onJump }: Props) {
  const evals = useMemo(() => {
    return transitions.map(t => parseEval(t.metadata?.eval))
  }, [transitions])

  // Only render if we have at least some eval data
  const hasData = evals.some(e => e !== null)
  if (!hasData) return null

  const n = evals.length
  const viewW = 400
  const viewH = 60
  const midY = viewH / 2

  // Clamp evals to ±5 pawns for display
  const clamp = 5
  // Positive eval (white winning) → line dips toward bottom (white's side)
  // Negative eval (black winning) → line rises toward top (black's side)
  const toY = (val: number | null) => {
    if (val === null) return midY
    const clamped = Math.max(-clamp, Math.min(clamp, val))
    return midY + (clamped / clamp) * (midY - 2)
  }

  // Build the area path — fill white advantage area
  const points = evals.map((e, i) => {
    const x = (i / Math.max(n - 1, 1)) * viewW
    const y = toY(e)
    return { x, y }
  })

  // SVG path: top edge (evals), then bottom edge (midline)
  const areaPath = [
    `M 0 ${midY}`,
    ...points.map(p => `L ${p.x} ${p.y}`),
    `L ${viewW} ${midY}`,
    'Z',
  ].join(' ')

  // Cursor position
  const cursorX = halfmove > 0 && halfmove <= n
    ? ((halfmove - 1) / Math.max(n - 1, 1)) * viewW
    : null

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-10 lg:h-14 cursor-pointer"
        preserveAspectRatio="none"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const pct = x / rect.width
          const move = Math.round(pct * (n - 1)) + 1
          onJump(Math.max(1, Math.min(n, move)))
        }}
      >
        {/* Background: top = black territory, bottom = white territory */}
        <rect x="0" y="0" width={viewW} height={midY} fill="rgba(0,0,0,0.08)" />
        <rect x="0" y={midY} width={viewW} height={midY} fill="rgba(0,0,0,0.02)" />

        {/* Center line */}
        <line x1="0" y1={midY} x2={viewW} y2={midY}
          stroke="currentColor" strokeWidth="0.5" opacity="0.2" />

        {/* Eval area — fills toward white's side (bottom) when white is winning */}
        <path d={areaPath} fill="rgba(120,120,120,0.3)" />

        {/* Eval line */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="rgba(100,100,100,0.6)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Move cursor */}
        {cursorX !== null && (
          <line x1={cursorX} y1="0" x2={cursorX} y2={viewH}
            stroke="rgba(59,130,246,0.8)" strokeWidth="1.5"
            vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  )
}
