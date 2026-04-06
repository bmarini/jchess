'use client'

import { useEffect, useRef, Fragment } from 'react'
import { extractNAG } from '@chess/annotation'
import Icon from './Icon'
import type { Transition } from '@chess/types'
import type { VarStep } from '@/hooks/useChessGame'

type Props = {
  transitions: Transition[]
  halfmove: number
  onJump: (n: number) => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  /** Variations at the current halfmove position (from mainTransitions[halfmove]) */
  currentVariations?: Transition[][]
  /** The halfmove in the main line where variations branch from */
  variationBranchHalfmove?: number
  onJumpToVariation?: (path: VarStep[], varHalfmove: number) => void
  isInVariation?: boolean
  onExitVariation?: () => void
  /** When in a variation, these are the variation's transitions */
  variationTransitions?: Transition[]
  variationHalfmove?: number
}

function MoveRow({
  transitions,
  halfmove,
  startHalfmove = 1,
  onJump,
  muted = false,
}: {
  transitions: Transition[]
  halfmove: number
  startHalfmove?: number
  onJump: (hm: number) => void
  muted?: boolean
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [halfmove])

  return (
    <div className="flex-1 flex items-center gap-0.5 overflow-x-auto py-1 scrollbar-hide">
      {transitions.map((t, i) => {
        const hm = startHalfmove + i
        const isWhite = hm % 2 === 1
        const isCurrent = hm === halfmove
        const { nag } = extractNAG(t.annotation)
        const hasVariations = t.variations.length > 0

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
              <span className={`text-xs shrink-0 ${muted ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {Math.ceil(hm / 2)}.
              </span>
            )}
            <button
              ref={isCurrent ? (el => { activeRef.current = el }) : undefined}
              onClick={() => onJump(hm)}
              className={[
                'shrink-0 px-1.5 py-0.5 rounded text-sm font-mono transition-colors relative',
                isCurrent
                  ? 'bg-blue-600 text-white font-semibold'
                  : muted
                    ? 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              ].join(' ')}
            >
              {t.san}
              {nag && <span className={isCurrent ? '' : nagClass}>{nag}</span>}
              {hasVariations && !isCurrent && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
              )}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

export default function MoveStrip({
  transitions,
  halfmove,
  onJump,
  onPrev,
  onNext,
  canPrev,
  canNext,
  currentVariations,
  variationBranchHalfmove,
  onJumpToVariation,
  isInVariation,
  onExitVariation,
  variationTransitions,
  variationHalfmove,
}: Props) {
  return (
    <div>
      {/* Main line */}
      <div className="flex items-center">
        <button onClick={onPrev} disabled={!canPrev}
          className="shrink-0 px-1.5 py-2 disabled:opacity-20">
          <Icon name="caret-left" size={16} className="dark:invert" />
        </button>
        <MoveRow
          transitions={transitions}
          halfmove={isInVariation ? -1 : halfmove}
          onJump={onJump}
        />
        <button onClick={onNext} disabled={!canNext}
          className="shrink-0 px-1.5 py-2 disabled:opacity-20">
          <Icon name="caret-right" size={16} className="dark:invert" />
        </button>
      </div>

      {/* Variation line */}
      {isInVariation && variationTransitions && onExitVariation && (
        <div className="flex items-center border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50">
          <button onClick={onExitVariation}
            className="shrink-0 px-1.5 py-1 text-blue-600 dark:text-blue-400">
            <Icon name="arrow-bend-up-left" size={14} />
          </button>
          <MoveRow
            transitions={variationTransitions}
            halfmove={variationHalfmove ?? 0}
            startHalfmove={variationBranchHalfmove ?? 1}
            onJump={(hm) => {
              // Jump within the current variation
              if (onJumpToVariation && isInVariation) {
                // This is handled via the hook's jumpTo since we're already in the variation
                onJump(hm - (variationBranchHalfmove ?? 1) + 1)
              }
            }}
            muted
          />
        </div>
      )}

      {/* Variation choices (when not in a variation but current move has variations) */}
      {!isInVariation && currentVariations && currentVariations.length > 0 && onJumpToVariation && variationBranchHalfmove !== undefined && (
        <div className="flex items-center gap-1 px-2 py-1 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] text-neutral-400 shrink-0">var:</span>
          {currentVariations.map((varLine, vi) => {
            if (varLine.length === 0) return null
            return (
              <button
                key={vi}
                onClick={() => onJumpToVariation(
                  [{ halfmove: variationBranchHalfmove, varIndex: vi }],
                  1,
                )}
                className="shrink-0 px-1.5 py-0.5 rounded text-xs font-mono text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                {varLine.slice(0, 3).map(t => t.san).join(' ')}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
