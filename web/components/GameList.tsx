'use client'

import type { GameEntry } from '@/lib/parseMultiPGN'

type Props = {
  games: GameEntry[]
  activeIndex: number
  onSelect: (index: number) => void
}

const RESULT_SYMBOL: Record<string, string> = {
  '1-0': '1-0',
  '0-1': '0-1',
  '1/2-1/2': '½-½',
  '*': '*',
}

export default function GameList({ games, activeIndex, onSelect }: Props) {
  if (games.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto">
      <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1 px-2">
        Games
      </div>
      {games.map((entry) => (
        <button
          key={entry.index}
          onClick={() => onSelect(entry.index)}
          className={[
            'text-left px-2 py-1.5 rounded text-sm transition-colors leading-snug',
            entry.index === activeIndex
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
          ].join(' ')}
        >
          <div className="truncate">{entry.label}</div>
          {entry.result !== '*' && (
            <div className="text-xs text-neutral-400 mt-0.5">
              {RESULT_SYMBOL[entry.result] ?? entry.result}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
