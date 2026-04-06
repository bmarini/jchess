'use client'

import { useState } from 'react'

const PRESETS = [
  { label: 'Beginner', level: 0, elo: '~800' },
  { label: 'Easy', level: 5, elo: '~1200' },
  { label: 'Medium', level: 10, elo: '~1600' },
  { label: 'Hard', level: 15, elo: '~2200' },
  { label: 'Max', level: 20, elo: '~3200' },
]

type Props = {
  onStart: (color: 'w' | 'b', skillLevel: number) => void
  onCancel: () => void
}

export default function BotDialog({ onStart, onCancel }: Props) {
  const [color, setColor] = useState<'w' | 'b'>('w')
  const [level, setLevel] = useState(5)

  // Interpolate ELO from level
  const elo = Math.round(800 + (level / 20) * 2400)
  const preset = PRESETS.reduce((best, p) =>
    Math.abs(p.level - level) < Math.abs(best.level - level) ? p : best
  )

  return (
    <div className="p-3 flex flex-col gap-3 text-sm">
      <div className="font-semibold text-xs text-neutral-500 uppercase tracking-wide">Play vs Stockfish</div>

      {/* Color picker */}
      <div>
        <div className="text-xs text-neutral-400 mb-1">Play as</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setColor('w')}
            className={[
              'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
              color === 'w'
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-150',
            ].join(' ')}
          >
            White
          </button>
          <button
            onClick={() => setColor('b')}
            className={[
              'flex-1 py-1.5 rounded text-xs font-medium transition-colors',
              color === 'b'
                ? 'bg-neutral-700 dark:bg-neutral-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-150',
            ].join(' ')}
          >
            Black
          </button>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <div className="text-xs text-neutral-400 mb-1">
          Difficulty: {preset.label} <span className="text-neutral-300">(~{elo})</span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={level}
          onChange={(e) => setLevel(parseInt(e.target.value, 10))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-[9px] text-neutral-400 mt-0.5">
          {PRESETS.map(p => (
            <span key={p.level}>{p.label}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded text-xs font-medium
            bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400
            hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onStart(color === 'w' ? 'b' : 'w', level)}
          className="flex-1 py-1.5 rounded text-xs font-medium
            bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Start Game
        </button>
      </div>
    </div>
  )
}
