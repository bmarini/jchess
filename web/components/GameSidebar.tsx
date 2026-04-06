'use client'

import { useState } from 'react'
import PGNInput from './PGNInput'
import BotDialog from './BotDialog'
import Icon from './Icon'
import type { GameEntry } from '@/lib/parseMultiPGN'

type Props = {
  games: GameEntry[]
  activeIndex: number
  onSelectGame: (index: number) => void
  onRemoveGame: (index: number) => void
  onLoadPGN: (pgn: string) => void
  onNewGame: () => void
  onDownloadAll: () => void
  onNewBotGame: (botColor: 'w' | 'b', skillLevel: number) => void
}

export default function GameSidebar({
  games, activeIndex,
  onSelectGame, onRemoveGame, onLoadPGN, onNewGame, onDownloadAll, onNewBotGame,
}: Props) {
  const [showInput, setShowInput] = useState(false)
  const [showBotDialog, setShowBotDialog] = useState(false)

  return (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-800 p-2 flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button onClick={onNewGame}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Icon name="note-pencil" size={14} className="dark:invert" /> New
          </button>
          <button onClick={() => setShowInput(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Icon name="plus" size={14} className="dark:invert" /> {showInput ? 'Close' : 'Load'}
          </button>
          {games.length > 0 && (
            <button onClick={onDownloadAll} title="Download all games"
              className="flex items-center justify-center px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <Icon name="download" size={14} className="dark:invert" />
            </button>
          )}
        </div>
        <button onClick={() => setShowBotDialog(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          <Icon name="robot" size={14} className="dark:invert" /> Play vs Bot
        </button>
      </div>
      {showBotDialog && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <BotDialog onStart={(botColor, skillLevel) => { onNewBotGame(botColor, skillLevel); setShowBotDialog(false) }} onCancel={() => setShowBotDialog(false)} />
        </div>
      )}
      {showInput && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-900">
          <PGNInput onLoad={(pgn) => { onLoadPGN(pgn); setShowInput(false) }} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {games.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {games.map((entry, i) => (
              <div key={i} className="flex items-center gap-0.5 group">
                <button onClick={() => onSelectGame(i)}
                  className={[
                    'text-left px-2 py-1.5 rounded text-sm transition-colors leading-snug flex-1 min-w-0',
                    activeIndex === i
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                  ].join(' ')}>
                  <div className="truncate">{entry.label}</div>
                  {(entry.game.headers['Date'] || entry.result !== '*') && (
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {[entry.game.headers['Date'], entry.result !== '*' ? entry.result : null].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
                <button onClick={() => onRemoveGame(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Remove">
                  <Icon name="trash" size={14} className="opacity-40 hover:opacity-70 dark:invert" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 italic px-2 py-4">
            No games loaded yet.
          </p>
        )}
      </div>
    </>
  )
}
