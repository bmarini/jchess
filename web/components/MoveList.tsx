'use client'

import { useEffect, useRef } from 'react'
import MoveTree from './MoveTree'
import type { Transition } from '@chess/types'
import type { VarStep } from '@/hooks/useChessGame'

type Props = {
  transitions: Transition[]
  mainHalfmove: number
  activeVarPath: VarStep[]
  varHalfmove: number
  onJump: (n: number) => void
  onJumpToVariation: (path: VarStep[], varHalfmove: number) => void
  onRemoveVariation: (path: VarStep[]) => void
  preAnnotation?: string
  /** Halfmove where the game first leaves book (from analysis). */
  outOfBook?: number
}

export default function MoveList({
  transitions,
  mainHalfmove,
  activeVarPath,
  varHalfmove,
  onJump,
  onJumpToVariation,
  onRemoveVariation,
  preAnnotation,
  outOfBook,
}: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [mainHalfmove, varHalfmove, activeVarPath])

  return (
    <div className="h-full overflow-y-auto text-sm leading-relaxed font-mono">
      {preAnnotation && (
        <p className="mb-3 text-neutral-500 italic text-xs leading-snug font-sans">
          {preAnnotation}
        </p>
      )}
      <MoveTree
        transitions={transitions}
        startHalfmove={1}
        mainHalfmove={mainHalfmove}
        activeVarPath={activeVarPath}
        varHalfmove={varHalfmove}
        onJump={onJump}
        onJumpToVariation={onJumpToVariation}
        onRemoveVariation={onRemoveVariation}
        activeRef={activeRef}
        varPath={[]}
        outOfBook={outOfBook}
      />
    </div>
  )
}
