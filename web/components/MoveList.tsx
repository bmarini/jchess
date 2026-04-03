'use client'

import { useEffect, useRef } from 'react'
import type { Transition } from '@chess/types'

type Props = {
  transitions: Transition[]
  halfmove: number
  isInVariation: boolean
  onJump: (n: number) => void
  onJumpToVariation: (mainHalfmove: number, varIndex: number, varHalfmove: number) => void
  preAnnotation?: string
}

export default function MoveList({
  transitions,
  halfmove,
  isInVariation,
  onJump,
  onJumpToVariation,
  preAnnotation,
}: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [halfmove])

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
        currentHalfmove={halfmove}
        isInVariation={isInVariation}
        onJump={onJump}
        onJumpToVariation={onJumpToVariation}
        activeRef={activeRef}
      />
    </div>
  )
}

type TreeProps = {
  transitions: Transition[]
  startHalfmove: number
  currentHalfmove: number
  isInVariation: boolean
  onJump: (n: number) => void
  onJumpToVariation: (mainHalfmove: number, varIndex: number, varHalfmove: number) => void
  activeRef: React.MutableRefObject<HTMLButtonElement | null>
  /** When non-null, clicking any move in this tree calls onJumpToVariation with these args */
  varContext?: { mainHalfmove: number; varIndex: number }
}

function MoveTree({
  transitions,
  startHalfmove,
  currentHalfmove,
  isInVariation,
  onJump,
  onJumpToVariation,
  activeRef,
  varContext,
}: TreeProps) {
  const items: React.ReactNode[] = []

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!
    const hm = startHalfmove + i
    const moveNum = Math.ceil(hm / 2)
    const isWhite = hm % 2 === 1
    const isCurrent = !varContext && hm === currentHalfmove

    // Move number
    if (isWhite) {
      items.push(
        <span key={`num-${hm}`} className="text-neutral-400 mr-0.5 select-none">
          {moveNum}.
        </span>
      )
    } else if (i === 0) {
      items.push(
        <span key={`num-${hm}`} className="text-neutral-400 mr-0.5 select-none">
          {moveNum}...
        </span>
      )
    }

    // Move button
    const handleClick = varContext
      ? () => onJumpToVariation(varContext.mainHalfmove, varContext.varIndex, hm - startHalfmove + 1)
      : () => onJump(hm)

    items.push(
      <button
        key={`move-${hm}`}
        ref={isCurrent ? (el => { activeRef.current = el }) : undefined}
        onClick={handleClick}
        className={[
          'px-1 py-0.5 rounded transition-colors mr-0.5',
          isCurrent
            ? 'bg-blue-600 text-white font-semibold'
            : varContext
              ? 'text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200',
        ].join(' ')}
      >
        {t.san}
      </button>
    )

    // Annotation after this move
    if (t.annotation) {
      items.push(
        <span key={`ann-${hm}`} className="text-neutral-500 dark:text-neutral-400 italic text-xs mx-1 font-sans">
          {t.annotation}
        </span>
      )
    }

    // Variations — rendered as indented block elements (not inline)
    if (!varContext && t.variations.length > 0) {
      const varBlocks: React.ReactNode[] = []
      for (let v = 0; v < t.variations.length; v++) {
        const varTransitions = t.variations[v]!
        if (varTransitions.length === 0) continue
        varBlocks.push(
          <div
            key={v}
            className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 pl-2 border-l-2 border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 my-0.5"
          >
            <MoveTree
              transitions={varTransitions}
              startHalfmove={hm}
              currentHalfmove={currentHalfmove}
              isInVariation={isInVariation}
              onJump={onJump}
              onJumpToVariation={onJumpToVariation}
              activeRef={activeRef}
              varContext={{ mainHalfmove: hm - 1, varIndex: v }}
            />
          </div>
        )
      }
      if (varBlocks.length > 0) {
        items.push(
          <div key={`vars-${hm}`} className="w-full ml-2 my-0.5 flex flex-col gap-0.5">
            {varBlocks}
          </div>
        )
      }
    }
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5">
      {items}
    </div>
  )
}
