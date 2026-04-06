'use client'

import { useEffect } from 'react'
import Icon from './Icon'

type Props = {
  onPrev: () => void
  onNext: () => void
  onFlip: () => void
  onStart: () => void
  onEnd: () => void
  canPrev: boolean
  canNext: boolean
  isInVariation: boolean
  onExitVariation: () => void
}

export default function Controls({
  onPrev, onNext, onFlip, onStart, onEnd,
  canPrev, canNext, isInVariation, onExitVariation,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext() }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); onPrev() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onNext, onPrev])

  const btn = (icon: string, onClick: () => void, disabled: boolean, title: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-2 lg:p-2.5 rounded transition-colors
        disabled:opacity-30 disabled:cursor-not-allowed
        bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300
        dark:bg-neutral-800 dark:hover:bg-neutral-700"
    >
      <Icon name={icon} size={22} className="dark:invert" />
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-1.5 lg:gap-2">
        {btn('skip-back', onStart, !canPrev, 'Start')}
        {btn('caret-left', onPrev, !canPrev, 'Previous (←)')}
        {btn('caret-right', onNext, !canNext, 'Next (→)')}
        {btn('skip-forward', onEnd, !canNext, 'End')}
        {btn('arrows-counter-clockwise', onFlip, false, 'Flip board')}
      </div>
      {isInVariation && (
        <button
          onClick={onExitVariation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium
            bg-blue-100 text-blue-700 hover:bg-blue-200
            dark:bg-blue-900 dark:text-blue-300"
        >
          <Icon name="arrow-bend-up-left" size={16} />
          main line
        </button>
      )}
    </div>
  )
}
