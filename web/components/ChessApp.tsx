'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Board from './Board'
import Controls from './Controls'
import MoveList from './MoveList'
import MoveStrip from './MoveStrip'
import PGNInput from './PGNInput'
import GameInfo from './GameInfo'
import Icon from './Icon'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import { Position } from '@chess/board'
import { useChessGame } from '@/hooks/useChessGame'
import { useEngine } from '@/hooks/useEngine'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import { compressPGN, decompressPGN, buildShareUrl, getEncodedPGNFromHash } from '@/lib/shareUrl'
import { loadLibrary, saveLibrary, loadActiveState, saveActiveState } from '@/lib/storage'
import { exportPGN } from '@chess/export'
import { identifyOpening } from '@/lib/openings'
import { analyzeGame } from '@/lib/analyze'
import type { AnalysisProgress } from '@/lib/analyze'
import type { GameEntry } from '@/lib/parseMultiPGN'

export default function ChessApp() {
  const [savedPGNs, setSavedPGNs] = useState<string[]>([])
  const [savedGames, setSavedGames] = useState<GameEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showInput, setShowInput] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
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
    if (activeIndex >= 0) {
      saveActiveState({ source: 'saved', index: activeIndex })
    }
  }, [activeIndex])

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
    setActiveIndex(index)
    chess.loadGame(entry.game)
    setDrawerOpen(false)
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
    const positions: Position[] = [Position.starting()]
    let pos = positions[0]!
    for (const t of transitions) {
      const result = pos.applyMove(t.san)
      if (result) pos = result.position
      positions.push(pos)
    }
    setAnalysisProgress({ current: 0, total: transitions.length, done: false })
    const result = await analyzeGame(transitions, (n) => positions[n]!, (progress) => {
      setAnalysisProgress(progress)
    })
    if (activeGame?.game) {
      activeGame.game.headers['WhiteAccuracy'] = String(result.whiteAccuracy)
      activeGame.game.headers['BlackAccuracy'] = String(result.blackAccuracy)
    }
    setAnalysisProgress(null)
    chess.refresh()
    persistCurrentGame()
  }, [chess, analysisProgress, persistCurrentGame, activeGame])

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

  const headers = activeGame?.game.headers ?? {}
  const white = headers['White']
  const black = headers['Black']
  const event = headers['Event']
  const date = headers['Date']

  const bestMoveArrow = chess.metadata?.bestUCI && (!detectedOpening || chess.halfmove > detectedOpening.lastBookMove)
    ? chess.metadata.bestUCI
    : undefined

  // ── Shared sidebar content (used in desktop sidebar + mobile drawer) ────────
  const sidebarContent = (
    <>
      <div className="border-b border-neutral-200 dark:border-neutral-800 p-2 flex gap-1.5">
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

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center gap-3">
        {/* Mobile hamburger */}
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

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
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

        {/* Center: board + controls */}
        <main className="flex flex-col items-center flex-1 min-w-0 overflow-hidden
          justify-start p-2 gap-1
          lg:justify-center lg:p-4 lg:gap-3">
          {activeGame ? (
            <>
              {/* Horizontal eval bar — mobile only */}
              {engine.enabled && (
                <div className="w-full lg:hidden">
                  <EvalBar eval_={engine.eval_} flipped={chess.flipped} />
                </div>
              )}

              {/* Board + vertical eval bar */}
              <div className="w-full flex justify-center gap-2" style={{ maxWidth: 'min(100%, 560px)' }}>
                {/* Vertical eval bar — desktop only */}
                {engine.enabled && (
                  <div className="hidden lg:block w-8 shrink-0">
                    <EvalBar eval_={engine.eval_} flipped={chess.flipped} />
                  </div>
                )}
                <div className="flex-1" style={{ maxWidth: '520px' }}>
                  <Board
                    position={chess.position}
                    flipped={chess.flipped}
                    lastCommands={lastCommands}
                    onMove={handleMove}
                    bestMoveArrow={bestMoveArrow}
                  />
                </div>
              </div>

              {/* Mobile eval graph */}
              <div className="w-full lg:hidden">
                <EvalGraph
                  transitions={chess.mainTransitions}
                  halfmove={chess.isInVariation ? 0 : chess.halfmove}
                  onJump={chess.jumpTo}
                />
              </div>

              {/* Mobile move strip + annotation */}
              <div className="w-full lg:hidden">
                <div className="border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                  {(() => {
                    // Compute variation data for mobile strip
                    const mainHm = chess.isInVariation ? chess.mainHalfmove : chess.halfmove
                    const currentTransition = chess.mainTransitions[mainHm]
                    const variations = currentTransition?.variations ?? []
                    return (
                      <MoveStrip
                        transitions={chess.mainTransitions}
                        halfmove={chess.isInVariation ? -1 : chess.halfmove}
                        onJump={chess.jumpTo}
                        onPrev={chess.prev}
                        onNext={chess.next}
                        canPrev={chess.halfmove > 0}
                        canNext={chess.halfmove < chess.totalMoves}
                        currentVariations={variations.length > 0 ? variations : undefined}
                        variationBranchHalfmove={mainHm}
                        onJumpToVariation={chess.jumpToVariation}
                        isInVariation={chess.isInVariation}
                        onExitVariation={chess.exitVariation}
                        variationTransitions={chess.isInVariation ? chess.transitions : undefined}
                        variationHalfmove={chess.isInVariation ? chess.halfmove : undefined}
                      />
                    )
                  })()}
                </div>
                {chess.annotation && (
                  <div className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 italic">
                    &ldquo;{chess.annotation}&rdquo;
                  </div>
                )}
              </div>

              {/* Engine PV + clock — desktop only */}
              <div className="hidden lg:flex h-6 items-center justify-center text-xs font-mono text-neutral-500 dark:text-neutral-400">
                {chess.metadata?.clk && (
                  <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded mr-2">
                    {chess.metadata.clk}
                  </span>
                )}
                {engine.enabled && engine.eval_ && engine.evalCurrent && engine.eval_.pv.length > 0 && (() => {
                  const sanMoves = pvToSAN(engine.eval_.pv).slice(0, 8)
                  return (
                    <span className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-neutral-400 dark:text-neutral-500">d{engine.eval_.depth}</span>
                      {sanMoves.map((san, i) => (
                        <button key={i}
                          onClick={() => { chess.playMoves(sanMoves.slice(0, i + 1)); setTimeout(persistCurrentGame, 0) }}
                          className="px-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
                          {san}
                        </button>
                      ))}
                    </span>
                  )
                })()}
              </div>

              {/* Controls */}
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
              {/* Mobile game actions */}
              <div className="flex items-center justify-center gap-2 lg:hidden">
                <button onClick={handleAnalyzeGame} disabled={!!analysisProgress}
                  title="Analyze" className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
                  <Icon name="magnifying-glass" size={18} className="dark:invert" />
                </button>
                <button onClick={handleShare} title="Share"
                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Icon name="share" size={18} className="dark:invert" />
                </button>
                <button onClick={handleCopyPGN} title="Copy PGN"
                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Icon name="copy" size={18} className="dark:invert" />
                </button>
                <button onClick={handleDownloadPGN} title="Download PGN"
                  className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Icon name="download" size={18} className="dark:invert" />
                </button>
              </div>
              {chess.warnings.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {chess.warnings.length} parsing warning(s)
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-20 lg:mt-0">
              Load a PGN to get started
            </p>
          )}
        </main>

        {/* Right panel — desktop only */}
        {activeGame && (
          <aside className="hidden lg:flex w-96 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
            {/* Game actions toolbar */}
            <div className="border-b border-neutral-200 dark:border-neutral-800 px-3 py-1.5 flex items-center gap-1">
              <button onClick={handleAnalyzeGame} disabled={!!analysisProgress}
                title={analysisProgress ? `Analyzing ${analysisProgress.current}/${analysisProgress.total}` : 'Analyze Game'}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
                <Icon name="magnifying-glass" size={16} className="dark:invert" />
                {analysisProgress ? <span className="font-mono">{analysisProgress.current}/{analysisProgress.total}</span> : 'Analyze'}
              </button>
              <div className="flex-1" />
              <button onClick={handleShare} title={shareStatus === 'copied' ? 'Copied!' : 'Share link'}
                className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <Icon name="share" size={16} className="dark:invert" />
              </button>
              <button onClick={handleCopyPGN} title={copyStatus === 'copied' ? 'Copied!' : 'Copy PGN'}
                className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <Icon name="copy" size={16} className="dark:invert" />
              </button>
              <button onClick={handleDownloadPGN} title="Download PGN"
                className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <Icon name="download" size={16} className="dark:invert" />
              </button>
            </div>
            <GameInfo game={activeGame.game} detectedOpening={detectedOpening} />
            <EvalGraph
              transitions={chess.mainTransitions}
              halfmove={chess.isInVariation ? 0 : chess.halfmove}
              onJump={chess.jumpTo}
            />
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
                outOfBook={detectedOpening && detectedOpening.lastBookMove < chess.mainTransitions.length ? detectedOpening.lastBookMove + 1 : undefined}
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
