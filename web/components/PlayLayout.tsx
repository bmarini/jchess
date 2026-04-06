'use client'

import Board from './Board'
import MoveStrip from './MoveStrip'
import Icon from './Icon'
import type { ChessGameState } from '@/hooks/useChessGame'
import type { GameOverState } from '@/hooks/useBotPlayer'
import type { TransitionCommand } from '@chess/types'

type Props = {
  chess: ChessGameState
  lastCommands: TransitionCommand[] | undefined
  onMove: (from: string, to: string, promotion?: import('@chess/types').PieceType) => void
  thinking: boolean
  gameOver: GameOverState
  onResign: () => void
}

export default function PlayLayout({
  chess, lastCommands, onMove, thinking, gameOver, onResign,
}: Props) {
  const canMove = !thinking && !gameOver
  return (
    <>
      <main className="flex flex-col items-center flex-1 min-w-0 overflow-hidden
        justify-start p-2 gap-2
        lg:justify-center lg:p-4 lg:gap-3">

        {/* Board */}
        <div className="w-full flex justify-center" style={{ maxWidth: 'min(100%, 640px)' }}>
          <div className="flex-1 relative" style={{ maxWidth: '600px' }}>
            <Board
              position={chess.position}
              flipped={chess.flipped}
              lastCommands={lastCommands}
              onMove={canMove ? onMove : undefined}
            />
            {thinking && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/40 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Icon name="cpu" size={14} /> Thinking...
                </div>
              </div>
            )}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 text-white text-sm font-semibold px-4 py-2 rounded-lg text-center">
                  {gameOver.reason === 'checkmate'
                    ? `Checkmate — ${gameOver.winner === 'w' ? 'White' : 'Black'} wins`
                    : 'Stalemate — Draw'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Move strip */}
        <div className="w-full border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <MoveStrip
            transitions={chess.mainTransitions}
            halfmove={chess.halfmove}
            onJump={chess.jumpTo}
            onPrev={chess.prev}
            onNext={chess.next}
            canPrev={chess.halfmove > 0}
            canNext={chess.halfmove < chess.totalMoves}
          />
        </div>

        {/* Play controls */}
        <div className="flex items-center justify-center gap-2 w-full" style={{ maxWidth: '320px' }}>
          <button
            onClick={onResign}
            className={[
              'px-4 py-2 rounded text-xs font-medium transition-colors',
              gameOver
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
            ].join(' ')}
          >
            {gameOver ? 'Review Game' : 'Resign'}
          </button>
          <button
            onClick={chess.flip}
            title="Flip board"
            className="p-2 rounded transition-colors
              bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <Icon name="arrows-counter-clockwise" size={20} className="dark:invert" />
          </button>
        </div>
      </main>
    </>
  )
}
