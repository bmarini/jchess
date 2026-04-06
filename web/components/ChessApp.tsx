'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import ReviewLayout from './ReviewLayout'
import PlayLayout from './PlayLayout'
import GameSidebar from './GameSidebar'
import Icon from './Icon'
import { toSAN } from '@chess/movegen'
import { useChessGame } from '@/hooks/useChessGame'
import { useEngine } from '@/hooks/useEngine'
import { useAnalysis } from '@/hooks/useAnalysis'
import { useBotPlayer } from '@/hooks/useBotPlayer'
import { useGameLibrary } from '@/hooks/useGameLibrary'
import { identifyOpening } from '@/lib/openings'
import type { BotConfig } from '@/hooks/useBotPlayer'

export default function ChessApp() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [botConfig, setBotConfig] = useState<BotConfig>(null)

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const library = useGameLibrary()
  const chess = useChessGame(library.activeGame?.game ?? undefined)
  const analysis = useAnalysis()

  const pvToSAN = useCallback((pv: string[]): string[] => {
    if (!chess.position) return pv
    const san: string[] = []
    let pos = chess.position
    for (const uci of pv) {
      const from = uci.slice(0, 2) as import('@chess/types').Square
      const to = uci.slice(2, 4) as import('@chess/types').Square
      const promo = uci.length > 4 ? uci[4]!.toUpperCase() as import('@chess/types').PieceType : undefined
      const s = toSAN(pos, from, to, promo)
      if (!s) break
      san.push(s)
      const result = pos.applyMove(s)
      if (!result) break
      pos = result.position
    }
    return san
  }, [chess.position])

  const currentFEN = chess.position?.toFEN() ?? null
  const engine = useEngine(currentFEN)

  const detectedOpening = useMemo(() => {
    const transitions = chess.mainTransitions
    if (transitions.length === 0) return null
    return identifyOpening(transitions.map(t => t.san))
  }, [chess.mainTransitions])

  const lastCommands = useMemo(() => {
    const t = chess.transitions
    const hm = chess.halfmove
    if (hm === 0) return undefined
    return t[hm - 1]?.forward
  }, [chess.halfmove, chess.transitions])

  const bestMoveArrow = chess.metadata?.bestUCI && (!detectedOpening || chess.halfmove > detectedOpening.lastBookMove)
    ? chess.metadata.bestUCI
    : undefined

  // ── Persistence helper ─────────────────────────────────────────────────────
  const persistCurrentGame = useCallback(() => {
    const game = library.activeGame?.game
    if (!game) return
    library.persistCurrentGame(chess.mainTransitions, game)
  }, [library, chess.mainTransitions])

  // ── Initialize from localStorage ──────────────────────────────────────────
  useEffect(() => {
    library.initialize((game) => chess.loadGame(game))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleMove = useCallback((from: string, to: string, promotion?: import('@chess/types').PieceType) => {
    chess.makeMove(from as import('@chess/types').Square, to as import('@chess/types').Square, promotion)
    setTimeout(persistCurrentGame, 0)
  }, [chess, persistCurrentGame])

  const botPlayer = useBotPlayer(botConfig, chess.position, handleMove)

  const handleSelectGame = useCallback((index: number) => {
    analysis.cancel()
    const entry = library.selectGame(index)
    if (entry) chess.loadGame(entry.game)
    setBotConfig(null)
    setDrawerOpen(false)
  }, [library, chess, analysis])

  const handleRemoveGame = useCallback((index: number) => {
    if (library.activeIndex === index) analysis.cancel()
    library.removeGame(index)
    setBotConfig(null)
  }, [library, analysis])

  const handleLoadPGN = useCallback((pgn: string) => {
    const entry = library.loadPGN(pgn)
    if (entry) chess.loadGame(entry.game)
    setBotConfig(null)
    setDrawerOpen(false)
  }, [library, chess])

  const handleNewBotGame = useCallback((botColor: 'w' | 'b', skillLevel: number) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const humanName = 'You'
    const botName = `Stockfish (Level ${skillLevel})`
    const white = botColor === 'w' ? botName : humanName
    const black = botColor === 'b' ? botName : humanName
    const pgn = `[Event "vs Stockfish"]\n[Site "jChess"]\n[Date "${today}"]\n[White "${white}"]\n[Black "${black}"]\n[Result "*"]\n\n*`
    handleLoadPGN(pgn)
    setBotConfig({ botColor, skillLevel })
    if (botColor === 'w') chess.flip()
  }, [handleLoadPGN, chess])

  const handleAnnotationBlur = useCallback((text: string) => {
    chess.setAnnotation(text)
    setTimeout(persistCurrentGame, 0)
  }, [chess, persistCurrentGame])

  const handleAnalyzeGame = useCallback(() => {
    if (analysis.state === 'running') return
    analysis.run(chess.mainTransitions, (result) => {
      if (library.activeGame?.game) {
        library.activeGame.game.headers['WhiteAccuracy'] = String(result.whiteAccuracy)
        library.activeGame.game.headers['BlackAccuracy'] = String(result.blackAccuracy)
      }
      chess.refresh()
      persistCurrentGame()
    })
  }, [chess, analysis, persistCurrentGame, library])

  // ── Derived ────────────────────────────────────────────────────────────────
  const headers = library.activeGame?.game.headers ?? {}
  const white = headers['White']
  const black = headers['Black']
  const event = headers['Event']
  const date = headers['Date']
  const isPlaying = botConfig !== null

  // ── Render ─────────────────────────────────────────────────────────────────
  const sidebar = (
    <GameSidebar
      games={library.games}
      activeIndex={library.activeIndex}
      onSelectGame={handleSelectGame}
      onRemoveGame={handleRemoveGame}
      onLoadPGN={handleLoadPGN}
      onNewGame={library.newGame}
      onDownloadAll={library.downloadAll}
      onNewBotGame={handleNewBotGame}
    />
  )

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-3">
        <button onClick={() => setDrawerOpen(v => !v)} className="lg:hidden p-1 -ml-1">
          <Icon name="list" size={20} className="dark:invert" />
        </button>
        <span className="font-semibold text-sm hidden lg:inline">jChess</span>
        <div className="flex-1 text-sm text-neutral-500 truncate min-w-0">
          {white && black ? `${white} – ${black}` : event ?? ''}
          {date && <span className="ml-2 text-xs text-neutral-400 hidden sm:inline">{date}</span>}
          {detectedOpening && (
            <span className="ml-2 text-xs text-purple-500 hidden sm:inline">{detectedOpening.name}</span>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-52 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
          {sidebar}
        </aside>

        {/* Content area */}
        {library.activeGame ? (
          isPlaying ? (
            <PlayLayout
              chess={chess}
              lastCommands={lastCommands}
              onMove={handleMove}
              thinking={botPlayer.thinking}
              gameOver={botPlayer.gameOver}
              onResign={() => setBotConfig(null)}
            />
          ) : (
            <ReviewLayout
              chess={chess}
              engine={engine}
              game={library.activeGame.game}
              detectedOpening={detectedOpening}
              lastCommands={lastCommands}
              bestMoveArrow={bestMoveArrow}
              pvToSAN={pvToSAN}
              onMove={handleMove}
              onAnnotationBlur={handleAnnotationBlur}
              onAnalyze={handleAnalyzeGame}
              analysisProgress={analysis.progress}
              persistCurrentGame={persistCurrentGame}
            />
          )
        ) : (
          <main className="flex flex-col items-center justify-center flex-1 min-w-0">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              Load a PGN to get started
            </p>
          </main>
        )}
      </div>
    </div>
  )
}
