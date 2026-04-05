import { StockfishEngine } from './engine'
import type { EngineEval } from './engine'
import type { Transition } from '@chess/types'
import type { Position } from '@chess/board'

const ANALYSIS_DEPTH = 16

/** Thresholds for eval swing (centipawns) */
const INACCURACY_THRESHOLD = 100
const MISTAKE_THRESHOLD = 200
const BLUNDER_THRESHOLD = 300

export type AnalysisProgress = {
  current: number
  total: number
  done: boolean
}

/**
 * Normalize an eval to white's perspective.
 * UCI score cp is from the side to move's perspective.
 */
function toWhitePerspective(score: number, isBlackToMove: boolean): number {
  return isBlackToMove ? -score : score
}

function classifySwing(swing: number): string | null {
  const abs = Math.abs(swing)
  if (abs >= BLUNDER_THRESHOLD) return '??'
  if (abs >= MISTAKE_THRESHOLD) return '?'
  if (abs >= INACCURACY_THRESHOLD) return '?!'
  return null
}

function formatEval(score: number, mate: number | null): string {
  if (mate !== null) return `#${mate}`
  const pawns = score / 100
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(2)
}

/**
 * Analyze all positions in a game, storing eval as metadata and
 * annotating blunders/mistakes/inaccuracies.
 *
 * @param transitions Main line transitions (mutated in place)
 * @param positionAt Function to get position at halfmove N
 * @param onProgress Called after each position is analyzed
 * @returns when analysis is complete
 */
export async function analyzeGame(
  transitions: Transition[],
  positionAt: (n: number) => Position,
  onProgress: (progress: AnalysisProgress) => void,
): Promise<void> {
  const engine = new StockfishEngine()
  await engine.init()

  const total = transitions.length
  const evals: (EngineEval | null)[] = []

  // Analyze starting position
  const startFen = positionAt(0).toFEN()
  const startEval = await engine.analyzePosition(startFen, ANALYSIS_DEPTH)
  const startWhiteScore = toWhitePerspective(startEval.score, false)
  evals.push(startEval)

  let prevWhiteScore = startWhiteScore

  for (let i = 0; i < total; i++) {
    const t = transitions[i]!
    const position = positionAt(i + 1)
    const fen = position.toFEN()
    const isBlackToMove = position.activeColor === 'b'

    const eval_ = await engine.analyzePosition(fen, ANALYSIS_DEPTH)
    evals.push(eval_)

    // Store eval as metadata (from white's perspective)
    const whiteScore = toWhitePerspective(eval_.score, isBlackToMove)
    const evalStr = formatEval(whiteScore, eval_.mate)
    t.metadata = { ...t.metadata, eval: evalStr }

    // Classify the move by eval swing
    // The move was made by the player who just moved (opposite of position.activeColor)
    const swing = whiteScore - prevWhiteScore
    // If white just moved, a negative swing is bad for white
    // If black just moved, a positive swing is bad for black
    const wasWhiteMove = isBlackToMove // white just moved if it's now black's turn
    const lossForMover = wasWhiteMove ? -swing : swing

    if (lossForMover > 0) {
      const classification = classifySwing(lossForMover)
      if (classification && !t.annotation) {
        t.annotation = classification
      }
    }

    prevWhiteScore = whiteScore

    onProgress({ current: i + 1, total, done: i === total - 1 })
  }

  engine.destroy()
}
