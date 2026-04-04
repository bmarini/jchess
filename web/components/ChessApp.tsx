'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import Board from './Board'
import Controls from './Controls'
import MoveList from './MoveList'
import GameList from './GameList'
import PGNInput from './PGNInput'
import GameInfo from './GameInfo'
import { useChessGame } from '@/hooks/useChessGame'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import { EXAMPLE_GAMES } from '@/lib/examples'
import { compressPGN, decompressPGN, buildShareUrl, getEncodedPGNFromHash } from '@/lib/shareUrl'
import { exportPGN } from '@chess/export'
import type { GameEntry } from '@/lib/parseMultiPGN'

type Props = {
  initialPgn?: string
}

function parseFirstExample(): GameEntry | null {
  const first = EXAMPLE_GAMES[0]
  if (!first) return null
  return parseMultiPGN(first.pgn)[0] ?? null
}

export default function ChessApp({ initialPgn }: Props) {
  const [activeGame, setActiveGame] = useState<GameEntry | null>(() =>
    initialPgn ? (parseMultiPGN(initialPgn)[0] ?? null) : parseFirstExample()
  )
  const [loadedGames, setLoadedGames] = useState<GameEntry[]>(() =>
    initialPgn ? parseMultiPGN(initialPgn) : []
  )
  const [activeLoadedIndex, setActiveLoadedIndex] = useState(0)
  const [activeExampleIndex, setActiveExampleIndex] = useState<number>(
    initialPgn ? -1 : 0
  )
  const [showInput, setShowInput] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const chess = useChessGame(activeGame?.game ?? undefined)

  const lastCommands = useMemo(() => {
    const t = chess.transitions
    const hm = chess.halfmove
    if (hm === 0) return undefined
    return t[hm - 1]?.forward
  }, [chess.halfmove, chess.transitions])

  const handleLoadPGN = useCallback((pgn: string) => {
    const newGames = parseMultiPGN(pgn)
    if (newGames.length === 0) return
    const first = newGames[0]!
    setLoadedGames(newGames)
    setActiveLoadedIndex(0)
    setActiveExampleIndex(-1)
    setActiveGame(first)
    chess.loadGame(first.game)
    setShowInput(false)
  }, [chess])

  const handleSelectLoadedGame = useCallback((index: number) => {
    const entry = loadedGames[index]
    if (!entry) return
    setActiveLoadedIndex(index)
    setActiveExampleIndex(-1)
    setActiveGame(entry)
    chess.loadGame(entry.game)
  }, [loadedGames, chess])

  const handleSelectExample = useCallback((index: number) => {
    const example = EXAMPLE_GAMES[index]
    if (!example) return
    const entry = parseMultiPGN(example.pgn)[0]
    if (!entry) return
    setActiveExampleIndex(index)
    setActiveGame(entry)
    chess.loadGame(entry.game)
  }, [chess])

  // Load PGN from URL hash on mount
  useEffect(() => {
    const encoded = getEncodedPGNFromHash()
    if (!encoded) return
    decompressPGN(encoded).then(pgn => {
      const games = parseMultiPGN(pgn)
      if (games.length === 0) return
      const first = games[0]!
      setLoadedGames(games)
      setActiveLoadedIndex(0)
      setActiveExampleIndex(-1)
      setActiveGame(first)
      chess.loadGame(first.game)
    }).catch(() => {
      // Ignore bad hash data
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = useCallback(async () => {
    const raw = activeGame?.raw
    if (!raw) return
    const encoded = await compressPGN(raw)
    const url = buildShareUrl(encoded)
    window.history.replaceState(null, '', url)
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }, [activeGame])

  const handleDownloadPGN = useCallback(() => {
    const game = activeGame?.game
    if (!game) return
    const pgn = exportPGN(game.headers, chess.mainTransitions, game.preAnnotation)
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const white = game.headers['White'] ?? 'game'
    const black = game.headers['Black'] ?? ''
    a.download = black ? `${white}-vs-${black}.pgn` : `${white}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeGame, chess.mainTransitions])

  const headers = activeGame?.game.headers ?? {}
  const white = headers['White']
  const black = headers['Black']
  const event = headers['Event']
  const date = headers['Date']

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-3">
        <span className="font-semibold text-sm">jChess</span>
        <div className="flex-1 text-sm text-neutral-500 truncate">
          {white && black ? `${white} – ${black}` : event ?? ''}
          {date && <span className="ml-2 text-xs text-neutral-400">{date}</span>}
        </div>
        <button
          onClick={handleShare}
          className="text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
            hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          {shareStatus === 'copied' ? 'Copied!' : 'Share'}
        </button>
        <button
          onClick={handleDownloadPGN}
          className="text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
            hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          Download PGN
        </button>
        <button
          onClick={() => setShowInput(v => !v)}
          className="text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
            hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          {showInput ? 'Close' : 'Load PGN'}
        </button>
      </header>

      {/* PGN input drawer */}
      {showInput && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50 dark:bg-neutral-900">
          <PGNInput onLoad={handleLoadPGN} />
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: examples + loaded games */}
        <aside className="w-48 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
            {/* Loaded games section — only shown when a multi-game PGN is loaded */}
            {loadedGames.length > 1 && (
              <div>
                <GameList
                  games={loadedGames}
                  activeIndex={activeExampleIndex === -1 ? activeLoadedIndex : -1}
                  onSelect={handleSelectLoadedGame}
                />
              </div>
            )}

            {/* Examples section */}
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1 px-2">
                Examples
              </div>
              <div className="flex flex-col gap-0.5">
                {EXAMPLE_GAMES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectExample(i)}
                    className={[
                      'text-left px-2 py-1.5 rounded text-sm transition-colors leading-snug w-full',
                      activeExampleIndex === i
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                    ].join(' ')}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: board */}
        <main className="flex flex-col items-center justify-center flex-1 p-4 gap-3 min-w-0">
          <div className="w-full" style={{ maxWidth: 'min(100%, 520px)' }}>
            <Board
              position={chess.position}
              flipped={chess.flipped}
              lastCommands={lastCommands}
            />
          </div>
          <div className="w-full" style={{ maxWidth: 'min(100%, 520px)' }}>
            <Controls
              onPrev={chess.prev}
              onNext={chess.next}
              onFlip={chess.flip}
              onStart={() => chess.jumpTo(0)}
              onEnd={() => chess.jumpTo(chess.totalMoves)}
              canPrev={chess.halfmove > 0}
              canNext={chess.halfmove < chess.totalMoves}
              isInVariation={chess.isInVariation}
              onExitVariation={chess.exitVariation}
            />
          </div>
          {chess.warnings.length > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              {chess.warnings.length} parsing warning(s)
            </div>
          )}
        </main>

        {/* Right panel: game info + move list + annotation */}
        <aside className="w-96 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          <GameInfo game={activeGame?.game ?? null} />
          <div className="flex-1 overflow-hidden p-3">
            <MoveList
              transitions={chess.mainTransitions}
              mainHalfmove={chess.mainHalfmove}
              activeVarPath={chess.activeVarPath}
              varHalfmove={chess.varHalfmove}
              onJump={chess.jumpTo}
              onJumpToVariation={chess.jumpToVariation}
              preAnnotation={activeGame?.game.preAnnotation}
            />
          </div>
          <div className="h-1/3 shrink-0 border-t border-neutral-200 dark:border-neutral-800 p-3 flex flex-col">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
              Annotation {chess.halfmove > 0 && chess.currentSAN ? `\u2014 ${chess.currentSAN}` : ''}
            </div>
            {chess.halfmove > 0 ? (
              <textarea
                key={`${chess.isInVariation}-${chess.halfmove}`}
                defaultValue={chess.annotation ?? ''}
                onBlur={(e) => chess.setAnnotation(e.target.value.trim())}
                placeholder="Add annotation..."
                className="flex-1 text-sm text-amber-700 dark:text-amber-400 leading-relaxed
                  bg-transparent resize-none focus:outline-none placeholder:text-neutral-300
                  dark:placeholder:text-neutral-600"
              />
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                Navigate to a move to add or edit annotations
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
