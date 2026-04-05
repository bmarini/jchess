'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Board from './Board'
import Controls from './Controls'
import MoveList from './MoveList'
import PGNInput from './PGNInput'
import GameInfo from './GameInfo'
import Icon from './Icon'
import EvalBar from './EvalBar'
import { Position } from '@chess/board'
import { useChessGame } from '@/hooks/useChessGame'
import { useEngine } from '@/hooks/useEngine'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import { compressPGN, decompressPGN, buildShareUrl, getEncodedPGNFromHash } from '@/lib/shareUrl'
import { loadLibrary, saveLibrary, loadActiveState, saveActiveState } from '@/lib/storage'
import { exportPGN } from '@chess/export'
import { analyzeGame } from '@/lib/analyze'
import type { AnalysisProgress } from '@/lib/analyze'
import type { GameEntry } from '@/lib/parseMultiPGN'

export default function ChessApp() {
  const [savedPGNs, setSavedPGNs] = useState<string[]>([])
  const [savedGames, setSavedGames] = useState<GameEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showInput, setShowInput] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null)
  const initializedRef = useRef(false)

  const activeGame = activeIndex >= 0 ? savedGames[activeIndex] ?? null : null

  const chess = useChessGame(activeGame?.game ?? undefined)

  // Load from localStorage on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // URL hash takes priority
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
      // Each PGN string maps to one game (1:1 with savedPGNs)
      const entries = pgns.map((p, i) => {
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

  // Persist active index
  useEffect(() => {
    if (activeIndex >= 0) {
      saveActiveState({ source: 'saved', index: activeIndex })
    }
  }, [activeIndex])

  /** Convert UCI long algebraic PV moves to SAN by replaying on the current position. */
  const pvToSAN = useCallback((pv: string[]): string[] => {
    if (!chess.position) return pv
    const san: string[] = []
    let pos = chess.position
    for (const uci of pv) {
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promo = uci.length > 4 ? uci[4]!.toUpperCase() as import('@chess/types').PieceType : undefined
      const s = pos.toSAN(from, to, promo)
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

  const lastCommands = useMemo(() => {
    const t = chess.transitions
    const hm = chess.halfmove
    if (hm === 0) return undefined
    return t[hm - 1]?.forward
  }, [chess.halfmove, chess.transitions])

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

  const handleLoadPGN = useCallback((pgn: string) => {
    const newEntries = parseMultiPGN(pgn)
    if (newEntries.length === 0) return

    // Store one PGN string per game entry (not per load batch)
    const newPGNs = newEntries.map(e => e.raw)
    const newIndex = savedGames.length
    setSavedPGNs(prev => {
      const next = [...prev, ...newPGNs]
      saveLibrary(next)
      return next
    })
    setSavedGames(prev => [...prev, ...newEntries])
    setActiveIndex(newIndex)
    chess.loadGame(newEntries[0]!.game)
    setShowInput(false)
  }, [chess, savedGames.length])

  const handleNewGame = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const pgn = `[Event "?"]\n[Site "?"]\n[Date "${today}"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n*`
    handleLoadPGN(pgn)
  }, [handleLoadPGN])

  const handleSelectGame = useCallback((index: number) => {
    const entry = savedGames[index]
    if (!entry) return
    setActiveIndex(index)
    chess.loadGame(entry.game)
  }, [savedGames, chess])

  const handleRemoveGame = useCallback((index: number) => {
    setSavedPGNs(prev => {
      const next = prev.filter((_, i) => i !== index)
      saveLibrary(next)
      return next
    })
    setSavedGames(prev => prev.filter((_, i) => i !== index))

    if (activeIndex === index) {
      setActiveIndex(-1)
    } else if (activeIndex > index) {
      setActiveIndex(prev => prev - 1)
    }
  }, [activeIndex])

  const handleMove = useCallback((from: string, to: string, promotion?: import('@chess/types').PieceType) => {
    chess.makeMove(from, to, promotion)
    setTimeout(persistCurrentGame, 0)
  }, [chess, persistCurrentGame])

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
    const white = game.headers['White'] ?? 'game'
    const black = game.headers['Black'] ?? ''
    a.download = black ? `${white}-vs-${black}.pgn` : `${white}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeGame, chess.mainTransitions])

  const handleAnalyzeGame = useCallback(async () => {
    const transitions = chess.mainTransitions
    if (transitions.length === 0 || analysisProgress) return

    // Build positions by replaying moves from starting position
    const positions: Position[] = [Position.starting()]
    let pos = positions[0]!
    for (const t of transitions) {
      const result = pos.applyMove(t.san)
      if (result) pos = result.position
      positions.push(pos)
    }

    setAnalysisProgress({ current: 0, total: transitions.length, done: false })

    await analyzeGame(transitions, (n) => positions[n]!, (progress) => {
      setAnalysisProgress(progress)
      if (progress.done) {
        setTimeout(() => {
          setAnalysisProgress(null)
          persistCurrentGame()
        }, 500)
      }
    })
  }, [chess.mainTransitions, analysisProgress, persistCurrentGame])

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
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: game library */}
        <aside className="w-52 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2">
            {savedGames.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {savedGames.map((entry, i) => (
                  <div key={i} className="flex items-center gap-0.5 group">
                    <button
                      onClick={() => handleSelectGame(i)}
                      className={[
                        'text-left px-2 py-1.5 rounded text-sm transition-colors leading-snug flex-1 min-w-0',
                        activeIndex === i
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                      ].join(' ')}
                    >
                      <div className="truncate">{entry.label}</div>
                      {(entry.game.headers['Date'] || entry.result !== '*') && (
                        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {[entry.game.headers['Date'], entry.result !== '*' ? entry.result : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveGame(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Remove"
                    >
                      <Icon name="trash" size={14} className="opacity-40 hover:opacity-70 dark:invert" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic px-2 py-4">
                No games loaded. Use Load PGN below to add games.
              </p>
            )}
          </div>

          {/* Sidebar actions */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 p-2 flex flex-col gap-1.5">
            <button
              onClick={handleNewGame}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Icon name="note-pencil" size={14} className="dark:invert" />
              New Game
            </button>
            <button
              onClick={() => setShowInput(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <Icon name="plus" size={14} className="dark:invert" />
              {showInput ? 'Close' : 'Load PGN'}
            </button>
            {activeGame && (
              <>
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                    hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Icon name="share" size={14} className="dark:invert" />
                  {shareStatus === 'copied' ? 'Copied!' : 'Share'}
                </button>
                <button
                  onClick={handleCopyPGN}
                  className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                    hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Icon name="copy" size={14} className="dark:invert" />
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy PGN'}
                </button>
                <button
                  onClick={handleAnalyzeGame}
                  disabled={!!analysisProgress}
                  className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                    hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  <Icon name="magnifying-glass" size={14} className="dark:invert" />
                  {analysisProgress
                    ? `Analyzing ${analysisProgress.current}/${analysisProgress.total}...`
                    : 'Analyze Game'}
                </button>
                <button
                  onClick={handleDownloadPGN}
                  className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded border border-neutral-300 dark:border-neutral-700
                    hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Icon name="download" size={14} className="dark:invert" />
                  Download PGN
                </button>
              </>
            )}
          </div>

          {/* PGN input drawer */}
          {showInput && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50 dark:bg-neutral-900">
              <PGNInput onLoad={handleLoadPGN} />
            </div>
          )}
        </aside>

        {/* Center: board */}
        <main className="flex flex-col items-center justify-center flex-1 p-4 gap-3 min-w-0">
          {activeGame ? (
            <>
              <div className="w-full flex justify-center gap-2" style={{ maxWidth: 'min(100%, 560px)' }}>
                {engine.enabled && (
                  <EvalBar eval_={engine.eval_} flipped={chess.flipped} />
                )}
                <div className="flex-1" style={{ maxWidth: '520px' }}>
                  <Board
                    position={chess.position}
                    flipped={chess.flipped}
                    lastCommands={lastCommands}
                    onMove={handleMove}
                  />
                </div>
              </div>
              {chess.metadata?.clk && (
                <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded">
                  {chess.metadata.clk}
                </div>
              )}
              {engine.enabled && engine.eval_ && (
                <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  <span className="text-neutral-400 dark:text-neutral-500">d{engine.eval_.depth}</span>
                  {engine.eval_.pv.length > 0 && (
                    <span className="ml-2">
                      {pvToSAN(engine.eval_.pv).slice(0, 8).join(' ')}
                    </span>
                  )}
                </div>
              )}
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
                  engineEnabled={engine.enabled}
                  engineState={engine.state}
                  onToggleEngine={engine.toggle}
                />
              </div>
              {chess.warnings.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {chess.warnings.length} parsing warning(s)
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              Load a PGN to get started
            </p>
          )}
        </main>

        {/* Right panel: game info + move list + annotation */}
        {activeGame && (
          <aside className="w-96 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
            <GameInfo game={activeGame.game} />
            <div className="flex-1 overflow-hidden p-3">
              <MoveList
                transitions={chess.mainTransitions}
                mainHalfmove={chess.mainHalfmove}
                activeVarPath={chess.activeVarPath}
                varHalfmove={chess.varHalfmove}
                onJump={chess.jumpTo}
                onJumpToVariation={chess.jumpToVariation}
                onRemoveVariation={chess.removeVariation}
                preAnnotation={activeGame.game.preAnnotation}
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
                  onBlur={(e) => handleAnnotationBlur(e.target.value.trim())}
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
        )}
      </div>
    </div>
  )
}
