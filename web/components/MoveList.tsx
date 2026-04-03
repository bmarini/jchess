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
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!
    const hm = startHalfmove + i
    const moveNum = Math.ceil(hm / 2)
    const isWhite = hm % 2 === 1
    // Highlight current move only in the main line (not inside variation previews)
    const isCurrent = !varContext && !isInVariation && hm === currentHalfmove

    // Move number
    if (isWhite) {
      nodes.push(
        <span key={`num-${hm}`} className="text-neutral-400 mr-0.5 select-none">
          {moveNum}.
        </span>
      )
    } else if (i === 0) {
      nodes.push(
        <span key={`num-${hm}`} className="text-neutral-400 mr-0.5 select-none">
          {moveNum}...
        </span>
      )
    }

    // Move button — calls jumpToVariation if inside a variation context, jumpTo otherwise
    const handleClick = varContext
      ? () => onJumpToVariation(varContext.mainHalfmove, varContext.varIndex, hm - startHalfmove + 1)
      : () => onJump(hm)

    nodes.push(
      <button
        key={`move-${hm}`}
        ref={isCurrent ? (el => { activeRef.current = el }) : undefined}
        onClick={handleClick}
        className={[
          'px-1 py-0.5 rounded transition-colors mr-0.5',
          isCurrent
            ? 'bg-blue-600 text-white font-semibold'
            : varContext
              ? 'text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200',
        ].join(' ')}
      >
        {t.san}
      </button>
    )

    // Annotation after this move
    if (t.annotation) {
      nodes.push(
        <span key={`ann-${hm}`} className="text-neutral-500 italic text-xs mx-1 font-sans">
          {t.annotation}
        </span>
      )
    }

    // Variations — each variation is a span (not a button) containing individual move buttons
    if (!varContext && t.variations.length > 0) {
      for (let v = 0; v < t.variations.length; v++) {
        const varTransitions = t.variations[v]!
        if (varTransitions.length === 0) continue
        nodes.push(
          <span key={`var-open-${hm}-${v}`} className="text-neutral-400 mx-0.5">{'('}</span>
        )
        nodes.push(
          <MoveTree
            key={`var-tree-${hm}-${v}`}
            transitions={varTransitions}
            startHalfmove={hm}
            currentHalfmove={currentHalfmove}
            isInVariation={isInVariation}
            onJump={onJump}
            onJumpToVariation={onJumpToVariation}
            activeRef={activeRef}
            varContext={{ mainHalfmove: hm - 1, varIndex: v }}
          />
        )
        nodes.push(
          <span key={`var-close-${hm}-${v}`} className="text-neutral-400 mx-0.5">{')'}</span>
        )
      }
    }
  }

  return <>{nodes}</>
}
