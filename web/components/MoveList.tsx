'use client'

import { useEffect, useRef } from 'react'
import { extractNAG } from '@chess/annotation'
import Icon from './Icon'
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

function pathEquals(a: VarStep[], b: VarStep[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.halfmove !== b[i]!.halfmove || a[i]!.varIndex !== b[i]!.varIndex) return false
  }
  return true
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

type TreeProps = {
  transitions: Transition[]
  startHalfmove: number
  mainHalfmove: number
  activeVarPath: VarStep[]
  varHalfmove: number
  onJump: (n: number) => void
  onJumpToVariation: (path: VarStep[], varHalfmove: number) => void
  onRemoveVariation: (path: VarStep[]) => void
  activeRef: React.MutableRefObject<HTMLButtonElement | null>
  varPath: VarStep[]
  outOfBook?: number
}

function MoveTree({
  transitions,
  startHalfmove,
  mainHalfmove,
  activeVarPath,
  varHalfmove,
  onJump,
  onJumpToVariation,
  onRemoveVariation,
  activeRef,
  varPath,
  outOfBook,
}: TreeProps) {
  const isVariation = varPath.length > 0
  const isActiveVar = isVariation && pathEquals(varPath, activeVarPath)
  const isOnMainLine = activeVarPath.length === 0
  const items: React.ReactNode[] = []

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!
    const hm = startHalfmove + i
    const moveNum = Math.ceil(hm / 2)
    const isWhite = hm % 2 === 1
    const localHm = hm - startHalfmove + 1

    const isCurrent = isActiveVar
      ? localHm === varHalfmove
      : !isVariation && isOnMainLine && hm === mainHalfmove

    // "Out of book" marker
    if (!isVariation && outOfBook !== undefined && hm === outOfBook) {
      items.push(
        <span
          key={`book-${hm}`}
          className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-sans font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 mr-1 select-none"
          title="Game leaves opening theory here"
        >
          book
        </span>
      )
    }

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
    const handleClick = isVariation
      ? () => onJumpToVariation(varPath, localHm)
      : () => onJump(hm)

    const { nag, text: annotationText } = extractNAG(t.annotation)
    const hasTextAnnotation = !!annotationText

    // NAG color classes
    const nagClass = nag === '??' || nag === '?'
      ? 'text-red-600 dark:text-red-400'
      : nag === '?!'
        ? 'text-amber-600 dark:text-amber-400'
        : nag === '!' || nag === '!!'
          ? 'text-green-600 dark:text-green-400'
          : nag === '!?'
            ? 'text-teal-600 dark:text-teal-400'
            : ''

    items.push(
      <button
        key={`move-${hm}`}
        ref={isCurrent ? (el => { activeRef.current = el }) : undefined}
        onClick={handleClick}
        className={[
          'px-1 py-0.5 rounded transition-colors mr-0.5',
          isCurrent
            ? 'bg-blue-600 text-white font-semibold'
            : hasTextAnnotation
              ? 'text-amber-700 dark:text-amber-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              : isVariation
                ? 'text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-400'
                : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200',
        ].join(' ')}
      >
        {t.san}
        {nag && <span className={isCurrent ? '' : nagClass}>{nag}</span>}
      </button>
    )

    // Variations — rendered as indented block elements
    if (t.variations.length > 0) {
      const varBlocks: React.ReactNode[] = []
      for (let v = 0; v < t.variations.length; v++) {
        const varTransitions = t.variations[v]!
        if (varTransitions.length === 0) continue
        const childPath = [...varPath, { halfmove: hm - startHalfmove, varIndex: v }]
        varBlocks.push(
          <div
            key={v}
            className="group/var flex items-start gap-0.5 pl-2 border-l-2 border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 my-0.5"
          >
            <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 flex-1 min-w-0">
              <MoveTree
                transitions={varTransitions}
                startHalfmove={hm}
                mainHalfmove={mainHalfmove}
                activeVarPath={activeVarPath}
                varHalfmove={varHalfmove}
                onJump={onJump}
                onJumpToVariation={onJumpToVariation}
                onRemoveVariation={onRemoveVariation}
                activeRef={activeRef}
                varPath={childPath}
              />
            </div>
            <button
              onClick={() => onRemoveVariation(childPath)}
              className="opacity-0 group-hover/var:opacity-100 transition-opacity shrink-0 pt-0.5 hover:brightness-0 hover:saturate-100"
              title="Remove variation"
            >
              <Icon name="x-circle" size={14} className="opacity-40 hover:opacity-100" />
            </button>
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
