'use client'

import { useEffect, useRef, Fragment } from 'react'
import { extractNAG } from '@chess/annotation'
import Icon from './Icon'
import type { Transition } from '@chess/types'

type Props = {
  transitions: Transition[]
  halfmove: number
  onJump: (n: number) => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}

/**
 * Horizontal scrolling move strip for mobile.
 * Shows main line moves only (no variations) in a single row with prev/next arrows.
 */
export default function MoveStrip({ transitions, halfmove, onJump, onPrev, onNext, canPrev, canNext }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [halfmove])

  return (
    <div className="flex items-center">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="shrink-0 px-1.5 py-2 disabled:opacity-20"
      >
        <Icon name="caret-left" size={16} className="dark:invert" />
      </button>
      <div className="flex-1 flex items-center gap-0.5 overflow-x-auto py-1.5 scrollbar-hide">
        {transitions.map((t, i) => {
          const hm = i + 1
          const isWhite = hm % 2 === 1
          const isCurrent = hm === halfmove
          const { nag } = extractNAG(t.annotation)

          const nagClass = nag === '??' || nag === '?'
            ? 'text-red-400'
            : nag === '?!'
              ? 'text-amber-400'
              : nag === '!' || nag === '!!'
                ? 'text-green-400'
                : nag === '!?'
                  ? 'text-teal-400'
                  : ''

          return (
            <Fragment key={hm}>
              {isWhite && (
                <span className="text-neutral-400 text-xs shrink-0">
                  {Math.ceil(hm / 2)}.
                </span>
              )}
              <button
                ref={isCurrent ? (el => { activeRef.current = el }) : undefined}
                onClick={() => onJump(hm)}
                className={[
                  'shrink-0 px-1.5 py-0.5 rounded text-sm font-mono transition-colors',
                  isCurrent
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
                ].join(' ')}
              >
                {t.san}
                {nag && <span className={isCurrent ? '' : nagClass}>{nag}</span>}
              </button>
            </Fragment>
          )
        })}
      </div>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="shrink-0 px-1.5 py-2 disabled:opacity-20"
      >
        <Icon name="caret-right" size={16} className="dark:invert" />
      </button>
    </div>
  )
}
