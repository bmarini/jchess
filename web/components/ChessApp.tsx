'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ReviewLayout from './ReviewLayout'
import PlayLayout from './PlayLayout'
import PGNInput from './PGNInput'
import BotDialog from './BotDialog'
import Icon from './Icon'
import { toSAN } from '@chess/movegen'
import { useChessGame } from '@/hooks/useChessGame'
import { useEngine } from '@/hooks/useEngine'
import { useBotPlayer } from '@/hooks/useBotPlayer'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import { compressPGN, decompressPGN, buildShareUrl, getEncodedPGNFromHash } from '@/lib/shareUrl'
import { loadLibrary, saveLibrary, loadActiveState, saveActiveState } from '@/lib/storage'
import { exportPGN } from '@chess/export'
import { identifyOpening } from '@/lib/openings'
import { useAnalysis } from '@/hooks/useAnalysis'
import type { BotConfig } from '@/hooks/useBotPlayer'
import type { GameEntry } from '@/lib/parseMultiPGN'

export default function ChessApp() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [savedPGNs, setSavedPGNs] = useState<string[]>([])
  const [savedGames, setSavedGames] = useState<GameEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showInput, setShowInput] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showBotDialog, setShowBotDialog] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [botConfig, setBotConfig] = useState<BotConfig>(null)
  const initializedRef = useRef(false)

  const activeGame = activeIndex >= 0 ? savedGames[activeIndex] ?? null : null

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const chess = useChessGame(activeGame?.game ?? undefined)
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
    const sans = transitions.map(t => t.san)
    return identifyOpening(sans)
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

  // ── Persistence ────────────────────────────────────────────────────────────
  const persistCurrentGame = useCallback(() => {
    if (activeIndex < 0) return
    const game = activeGame?.game
    if (!game) return
    const pgn = exportPGN(game.headers, chess.mainTransitions, game.preAnnotation)
    setSavedPGNs(prev => {
      const next = [...prev]
      next[activeIndex] = pgn
      saveLibrary(next)
      return next
    })
  }, [activeIndex, activeGame, chess.mainTransitions])

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const encoded = getEncodedPGNFromHash()
    if (encoded) {
      decompressPGN(encoded).then(pgn => {
        const entries = parseMultiPGN(pgn)
        if (entries.length === 0) return
        setSavedPGNs([pgn])
        setSavedGames(entries)
        setActiveIndex(0)
        saveLibrary([pgn])
        saveActiveState({ source: 'saved', index: 0 })
        chess.loadGame(entries[0]!.game)
      }).catch(() => {})
      return
    }

    const pgns = loadLibrary()
    if (pgns.length > 0) {
      const entries = pgns.map((p) => {
        const parsed = parseMultiPGN(p)
        return parsed[0] ?? null
      }).filter((e): e is GameEntry => e !== null)
      setSavedPGNs(pgns.slice(0, entries.length))
      setSavedGames(entries)
      const active = loadActiveState()
      const idx = active?.index ?? 0
      if (idx < entries.length) {
        setActiveIndex(idx)
        chess.loadGame(entries[idx]!.game)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeIndex >= 0) saveActiveState({ source: 'saved', index: activeIndex })
  }, [activeIndex])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLoadPGN = useCallback((pgn: string) => {
    const newEntries = parseMultiPGN(pgn)
    if (newEntries.length === 0) return
    const newPGNs = newEntries.map(e => e.raw)
    const newIndex = savedGames.length
    setSavedPGNs(prev => { const next = [...prev, ...newPGNs]; saveLibrary(next); return next })
    setSavedGames(prev => [...prev, ...newEntries])
    setActiveIndex(newIndex)
    chess.loadGame(newEntries[0]!.game)
    setBotConfig(null)
    setShowInput(false)
    setDrawerOpen(false)
  }, [chess, savedGames.length])

  const handleNewGame = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const pgn = `[Event "?"]\n[Site "?"]\n[Date "${today}"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n*`
    handleLoadPGN(pgn)
  }, [handleLoadPGN])

  const handleSelectGame = useCallback((index: number) => {
    const entry = savedGames[index]
    if (!entry) return
    analysis.cancel()
    setActiveIndex(index)
    chess.loadGame(entry.game)
    setBotConfig(null)
    setDrawerOpen(false)
  }, [savedGames, chess, analysis])

  const handleRemoveGame = useCallback((index: number) => {
    if (activeIndex === index) analysis.cancel()
    setSavedPGNs(prev => { const next = prev.filter((_, i) => i !== index); saveLibrary(next); return next })
    setSavedGames(prev => prev.filter((_, i) => i !== index))
    if (activeIndex === index) { setActiveIndex(-1); setBotConfig(null) }
    else if (activeIndex > index) setActiveIndex(prev => prev - 1)
  }, [activeIndex, analysis])

  const handleMove = useCallback((from: string, to: string, promotion?: import('@chess/types').PieceType) => {
    chess.makeMove(from as import('@chess/types').Square, to as import('@chess/types').Square, promotion)
    setTimeout(persistCurrentGame, 0)
  }, [chess, persistCurrentGame])

  const botPlayer = useBotPlayer(botConfig, chess.position, handleMove)

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
    setShowBotDialog(false)
  }, [handleLoadPGN, chess])

  const handleResign = useCallback(() => {
    setBotConfig(null)
  }, [])

  const handleAnnotationBlur = useCallback((text: string) => {
    chess.setAnnotation(text)
    setTimeout(persistCurrentGame, 0)
  }, [chess, persistCurrentGame])

  const handleShare = useCallback(async () => {
    const game = activeGame?.game
    if (!game) return
    const pgn = exportPGN(game.headers, chess.mainTransitions, game.preAnnotation)
    const encoded = await compressPGN(pgn)
    const url = buildShareUrl(encoded)
    window.history.replaceState(null, '', url)
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }, [activeGame, chess.mainTransitions])

  const handleCopyPGN = useCallback(async () => {
    const game = activeGame?.game
    if (!game) return
    const pgn = exportPGN(game.headers, chess.mainTransitions, game.preAnnotation)
    await navigator.clipboard.writeText(pgn)
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 2000)
  }, [activeGame, chess.mainTransitions])

  const handleDownloadPGN = useCallback(() => {
    const game = activeGame?.game
    if (!game) return
    const pgn = exportPGN(game.headers, chess.mainTransitions, game.preAnnotation)
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const w = game.headers['White'] ?? 'game'
    const b = game.headers['Black'] ?? ''
    a.download = b ? `${w}-vs-${b}.pgn` : `${w}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeGame, chess.mainTransitions])

  const handleAnalyzeGame = useCallback(() => {
    if (analysis.state === 'running') return
    analysis.run(chess.mainTransitions, (result) => {
      if (activeGame?.game) {
        activeGame.game.headers['WhiteAccuracy'] = String(result.whiteAccuracy)
        activeGame.game.headers['BlackAccuracy'] = String(result.blackAccuracy)
      }
      chess.refresh()
      persistCurrentGame()
    })
  }, [chess, analysis, persistCurrentGame, activeGame])

  const handleDownloadAll = useCallback(() => {
    if (savedPGNs.length === 0) return
    const allPGN = savedPGNs.join('\n\n')
    const blob = new Blob([allPGN], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jchess-games.pgn'
    a.click()
    URL.revokeObjectURL(url)
  }, [savedPGNs])

  // ── Derived ────────────────────────────────────────────────────────────────
  const headers = activeGame?.game.headers ?? {}
  const white = headers['White']
  const black = headers['Black']
  const event = headers['Event']
  const date = headers['Date']

  const isPlaying = botConfig !== null

  // ── Sidebar content (shared between desktop sidebar + mobile drawer) ──────
  const sidebarContent = (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-800 p-2 flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button onClick={handleNewGame}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Icon name="note-pencil" size={14} className="dark:invert" /> New
          </button>
          <button onClick={() => setShowInput(v => !v)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Icon name="plus" size={14} className="dark:invert" /> {showInput ? 'Close' : 'Load'}
          </button>
          {savedPGNs.length > 0 && (
            <button onClick={handleDownloadAll} title="Download all games"
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
          <BotDialog onStart={handleNewBotGame} onCancel={() => setShowBotDialog(false)} />
        </div>
      )}
      {showInput && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-900">
          <PGNInput onLoad={handleLoadPGN} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2">
        {savedGames.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {savedGames.map((entry, i) => (
              <div key={i} className="flex items-center gap-0.5 group">
                <button onClick={() => handleSelectGame(i)}
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
                <button onClick={() => handleRemoveGame(i)}
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

  // ── Render ─────────────────────────────────────────────────────────────────
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
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-52 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
          {sidebarContent}
        </aside>

        {/* Content area — switches between Play and Review layouts */}
        {activeGame ? (
          isPlaying ? (
            <PlayLayout
              chess={chess}
              lastCommands={lastCommands}
              onMove={handleMove}
              thinking={botPlayer.thinking}
              gameOver={botPlayer.gameOver}
              onResign={handleResign}
            />
          ) : (
            <ReviewLayout
              chess={chess}
              engine={engine}
              game={activeGame.game}
              detectedOpening={detectedOpening}
              lastCommands={lastCommands}
              bestMoveArrow={bestMoveArrow}
              pvToSAN={pvToSAN}
              onMove={handleMove}
              onAnnotationBlur={handleAnnotationBlur}
              onAnalyze={handleAnalyzeGame}
              analysisProgress={analysis.progress}
              onShare={handleShare}
              shareStatus={shareStatus}
              onCopyPGN={handleCopyPGN}
              copyStatus={copyStatus}
              onDownloadPGN={handleDownloadPGN}
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
