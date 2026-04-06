'use client'

import Board from './Board'
import Controls from './Controls'
import MoveList from './MoveList'
import MoveStrip from './MoveStrip'
import GameInfo from './GameInfo'
import Icon from './Icon'
import EvalBar from './EvalBar'
import EvalGraph from './EvalGraph'
import type { ChessGameState } from '@/hooks/useChessGame'
import type { UseEngineResult } from '@/hooks/useEngine'
import type { OpeningInfo } from '@/lib/openings'
import type { AnalysisProgress } from '@/lib/analyze'
import type { ParsedGame, TransitionCommand } from '@chess/types'
import { useGameActions } from '@/hooks/useGameActions'

type Props = {
  chess: ChessGameState
  engine: UseEngineResult
  game: ParsedGame
  detectedOpening: OpeningInfo | null
  lastCommands: TransitionCommand[] | undefined
  bestMoveArrow: string | undefined
  pvToSAN: (pv: string[]) => string[]
  onMove: (from: string, to: string, promotion?: import('@chess/types').PieceType) => void
  onAnnotationBlur: (text: string) => void
  onAnalyze: () => void
  analysisProgress: AnalysisProgress | null
  persistCurrentGame: () => void
}

export default function ReviewLayout({
  chess, engine, game, detectedOpening,
  lastCommands, bestMoveArrow, pvToSAN,
  onMove, onAnnotationBlur,
  onAnalyze, analysisProgress,
  persistCurrentGame,
}: Props) {
  const { handleShare, handleCopyPGN, handleDownloadPGN, shareStatus, copyStatus } =
    useGameActions(game, chess.mainTransitions)
  const outOfBook = detectedOpening && detectedOpening.lastBookMove < chess.mainTransitions.length
    ? detectedOpening.lastBookMove + 1
    : undefined

  return (
    <>
      {/* Center: board + controls */}
      <main className="flex flex-col items-center flex-1 min-w-0 overflow-hidden
        justify-start p-2 gap-1
        lg:justify-center lg:p-4 lg:gap-3">
        {/* Horizontal eval bar — mobile only */}
        {engine.enabled && (
          <div className="w-full lg:hidden">
            <EvalBar eval_={engine.eval_} flipped={chess.flipped} />
          </div>
        )}

        {/* Board + vertical eval bar */}
        <div className="w-full flex justify-center gap-2" style={{ maxWidth: 'min(100%, 640px)' }}>
          {engine.enabled && (
            <div className="hidden lg:block w-8 shrink-0">
              <EvalBar eval_={engine.eval_} flipped={chess.flipped} />
            </div>
          )}
          <div className="flex-1 relative" style={{ maxWidth: '600px' }}>
            <Board
              position={chess.position}
              flipped={chess.flipped}
              lastCommands={lastCommands}
              onMove={onMove}
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
            canPrev={chess.halfmove > 0}
            canNext={chess.halfmove < chess.totalMoves}
            isInVariation={chess.isInVariation}
            onExitVariation={chess.exitVariation}
          />
        </div>

        {/* Mobile game actions */}
        <div className="flex items-center justify-center gap-2 lg:hidden">
          <button onClick={onAnalyze} disabled={!!analysisProgress}
            title="Review with Stockfish"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors
              bg-blue-50 text-blue-700 hover:bg-blue-100
              dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900 disabled:opacity-50">
            <Icon name="magnifying-glass" size={16} />
            {analysisProgress ? `${analysisProgress.current}/${analysisProgress.total}` : 'Review'}
          </button>
          <button onClick={engine.toggle}
            title={engine.enabled ? 'Disable engine' : 'Enable engine'}
            className={[
              'p-1.5 rounded transition-colors',
              engine.enabled
                ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-900'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ].join(' ')}>
            <Icon name="cpu" size={18} className={engine.enabled ? '' : 'dark:invert opacity-40'} />
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
      </main>

      {/* Right panel — desktop only */}
      <aside className="hidden lg:flex w-96 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex-col overflow-hidden">
        {/* Game actions toolbar */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-3 py-1.5 flex items-center gap-1">
          <button onClick={onAnalyze} disabled={!!analysisProgress}
            title={analysisProgress ? `Reviewing ${analysisProgress.current}/${analysisProgress.total}` : 'Review with Stockfish'}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded font-medium transition-colors
              bg-blue-50 text-blue-700 hover:bg-blue-100
              dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900 disabled:opacity-50">
            <Icon name="magnifying-glass" size={16} />
            {analysisProgress ? <span className="font-mono">{analysisProgress.current}/{analysisProgress.total}</span> : 'Review'}
          </button>
          <button onClick={engine.toggle}
            title={engine.enabled ? 'Disable engine' : 'Enable engine'}
            className={[
              'p-1.5 rounded transition-colors',
              engine.enabled
                ? 'bg-green-100 hover:bg-green-200 dark:bg-green-900/50 dark:hover:bg-green-900'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ].join(' ')}>
            <Icon name="cpu" size={16} className={engine.enabled ? '' : 'dark:invert opacity-40'} />
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
        <GameInfo game={game} detectedOpening={detectedOpening} />
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
            preAnnotation={game.preAnnotation}
            outOfBook={outOfBook}
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
              onBlur={(e) => onAnnotationBlur(e.target.value.trim())}
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
    </>
  )
}
