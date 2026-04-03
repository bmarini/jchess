'use client'

import { useState, useCallback, useMemo } from 'react'
import Board from './Board'
import Controls from './Controls'
import MoveList from './MoveList'
import GameList from './GameList'
import PGNInput from './PGNInput'
import { useChessGame } from '@/hooks/useChessGame'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import type { GameEntry } from '@/lib/parseMultiPGN'

const DEFAULT_PGN = `[Event "F/S Return Match"]
[Site "Belgrade, Serbia JUG"]
[Date "1992.11.04"]
[Round "29"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 {This opening is called the Ruy Lopez.} 3... a6
4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7
11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5
Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6
23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5
hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5
35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6
Nf2 42. g4 Bd3 43. Re6 1/2-1/2`

type Props = {
  initialPgn?: string
}

export default function ChessApp({ initialPgn }: Props) {
  const [games, setGames] = useState<GameEntry[]>(() =>
    parseMultiPGN(initialPgn ?? DEFAULT_PGN)
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [showInput, setShowInput] = useState(false)

  const activeGame = games[activeIndex]

  const chess = useChessGame(activeGame?.game)

  const lastCommands = useMemo(() => {
    if (chess.halfmove === 0) return undefined
    const t = chess.transitions[chess.halfmove - 1]
    return t?.forward
  }, [chess.halfmove, chess.transitions])

  const handleLoadPGN = useCallback((pgn: string) => {
    const newGames = parseMultiPGN(pgn)
    if (newGames.length === 0) return
    setGames(newGames)
    setActiveIndex(0)
    chess.loadGame(newGames[0]!.game)
    setShowInput(false)
  }, [chess])

  const handleSelectGame = useCallback((index: number) => {
    const entry = games[index]
    if (!entry) return
    setActiveIndex(index)
    chess.loadGame(entry.game)
  }, [games, chess])

  const headers = activeGame?.game.headers ?? {}
  const white = headers['White']
  const black = headers['Black']
  const event = headers['Event']
  const date = headers['Date']
  const result = activeGame?.result

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
        {/* Left sidebar: game list */}
        {games.length > 1 && (
          <aside className="w-48 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-2 overflow-y-auto">
            <GameList
              games={games}
              activeIndex={activeIndex}
              onSelect={handleSelectGame}
            />
          </aside>
        )}

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

        {/* Right panel: move list + annotation */}
        <aside className="w-96 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-3">
            <MoveList
              transitions={chess.transitions}
              halfmove={chess.halfmove}
              isInVariation={chess.isInVariation}
              onJump={chess.jumpTo}
              onJumpToVariation={chess.jumpToVariation}
              preAnnotation={activeGame?.game.preAnnotation}
            />
          </div>
          {chess.annotation && (
            <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 shrink-0">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                Annotation
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed italic">
                &ldquo;{chess.annotation}&rdquo;
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
