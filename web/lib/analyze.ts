import { StockfishEngine } from './engine'
import type { EngineEval } from './engine'
import type { Transition } from '@chess/types'
import type { Position } from '@chess/board'

const ANALYSIS_DEPTH = 16

/** Thresholds for eval swing (centipawns) */
const INACCURACY_THRESHOLD = 100
const MISTAKE_THRESHOLD = 200
const BLUNDER_THRESHOLD = 300

/** Eval stays within this range (centipawns) = still in book/theory */
const BOOK_THRESHOLD = 30

export type AnalysisProgress = {
  current: number
  total: number
  done: boolean
}

export type AnalysisResult = {
  whiteAccuracy: number
  blackAccuracy: number
  /** Halfmove number where the game first leaves book (null if never) */
  outOfBook: number | null
}

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
 * Convert centipawn loss to an accuracy percentage (chess.com-like formula).
 * 0 cp loss → 100%, ~50 cp → ~40%, 200+ cp → ~0%
 */
function cpLossToAccuracy(cpLoss: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, cpLoss)) - 3.1668))
}

/**
 * Convert a UCI long algebraic move to from/to squares.
 */
function uciToSquares(uci: string): { from: string; to: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) }
}

/**
 * Analyze all positions in a game:
 * - Stores [%eval] and [%bestMove] metadata on each transition
 * - Annotates blunders/mistakes/inaccuracies with NAG symbols
 * - Computes accuracy scores for both players
 * - Detects where the game leaves book
 */
export async function analyzeGame(
  transitions: Transition[],
  positionAt: (n: number) => Position,
  onProgress: (progress: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  const engine = new StockfishEngine()
  await engine.init()

  const total = transitions.length
  let outOfBook: number | null = null
  const whiteAccuracies: number[] = []
  const blackAccuracies: number[] = []

  // Analyze starting position to get the baseline eval
  const startPos = positionAt(0)
  const startEval = await engine.analyzePosition(startPos.toFEN(), ANALYSIS_DEPTH)
  let prevWhiteScore = toWhitePerspective(startEval.score, false)
  let prevBestMove = startEval.pv[0] ?? null

  for (let i = 0; i < total; i++) {
    const t = transitions[i]!
    const posAfter = positionAt(i + 1)
    const isBlackToMove = posAfter.activeColor === 'b'
    const wasWhiteMove = isBlackToMove // white just moved if it's now black's turn

    // Store the engine's best move for the position BEFORE this move
    // Format: "from:to" (e.g., "e2:e4") for arrow rendering + SAN for display
    if (prevBestMove) {
      const { from, to } = uciToSquares(prevBestMove)
      const posBefore = positionAt(i)
      const bestSAN = posBefore.toSAN(from, to)
      if (bestSAN) {
        t.metadata = { ...t.metadata, best: bestSAN, bestUCI: `${from}:${to}` }
      }
    }

    // Analyze position after this move
    const eval_ = await engine.analyzePosition(posAfter.toFEN(), ANALYSIS_DEPTH)
    const whiteScore = toWhitePerspective(eval_.score, isBlackToMove)
    const evalStr = formatEval(whiteScore, eval_.mate)
    t.metadata = { ...t.metadata, eval: evalStr }

    // Centipawn loss for the mover
    const swing = whiteScore - prevWhiteScore
    const cpLoss = wasWhiteMove ? Math.max(0, -swing) : Math.max(0, swing)

    // Accuracy
    const accuracy = cpLossToAccuracy(cpLoss)
    if (wasWhiteMove) {
      whiteAccuracies.push(accuracy)
    } else {
      blackAccuracies.push(accuracy)
    }

    // NAG annotation for bad moves — prepend to existing annotation
    if (cpLoss > 0) {
      const classification = classifySwing(cpLoss)
      if (classification) {
        t.annotation = t.annotation
          ? `${classification} ${t.annotation}`
          : classification
      }
    }

    // Book detection: first move where eval goes outside the threshold
    if (outOfBook === null && Math.abs(whiteScore) > BOOK_THRESHOLD) {
      outOfBook = i + 1
    }

    prevWhiteScore = whiteScore
    prevBestMove = eval_.pv[0] ?? null

    onProgress({ current: i + 1, total, done: i === total - 1 })
  }

  engine.destroy()

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 100

  return {
    whiteAccuracy: Math.round(avg(whiteAccuracies) * 10) / 10,
    blackAccuracy: Math.round(avg(blackAccuracies) * 10) / 10,
    outOfBook,
  }
}
