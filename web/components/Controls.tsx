'use client'

import { useEffect } from 'react'

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

  const btn = (label: string, onClick: () => void, disabled: boolean, title?: string) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-3 py-1.5 rounded text-sm font-medium transition-colors
        disabled:opacity-30 disabled:cursor-not-allowed
        bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300
        dark:bg-neutral-800 dark:hover:bg-neutral-700"
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {btn('⟨⟨', onStart, !canPrev, 'Start')}
      {btn('◀', onPrev, !canPrev, 'Previous (←)')}
      {btn('▶', onNext, !canNext, 'Next (→)')}
      {btn('⟩⟩', onEnd, !canNext, 'End')}
      <div className="flex-1" />
      {isInVariation && (
        <button
          onClick={onExitVariation}
          className="px-3 py-1.5 rounded text-sm font-medium
            bg-blue-100 text-blue-700 hover:bg-blue-200
            dark:bg-blue-900 dark:text-blue-300"
        >
          ← main line
        </button>
      )}
      <button
        onClick={onFlip}
        title="Flip board"
        className="px-3 py-1.5 rounded text-sm font-medium
          bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300
          dark:bg-neutral-800 dark:hover:bg-neutral-700"
      >
        ⟲
      </button>
    </div>
  )
}
