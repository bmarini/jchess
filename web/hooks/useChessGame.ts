'use client'

import { useRef, useState, useCallback } from 'react'
import { Position } from '@chess/board'
import { buildTransitions, GamePlayer } from '@chess/transitions'
import type { Transition } from '@chess/types'
import type { ParsedGame } from '@chess/types'

export type VarStep = { halfmove: number; varIndex: number }

export type ChessGameState = {
  position: Position | null
  halfmove: number
  totalMoves: number
  currentSAN: string | null
  annotation: string | undefined
  /** Always the main line transitions (for MoveList to render the full tree). */
  mainTransitions: Transition[]
  /** Current line transitions (main or variation — for Controls canNext/canPrev). */
  transitions: Transition[]
  isInVariation: boolean
  /** Path to the active variation (empty when on main line). */
  activeVarPath: VarStep[]
  /** Halfmove within the active variation (only meaningful when activeVarPath is non-empty). */
  varHalfmove: number
  /** Halfmove on the main line (branch point when inside a variation). */
  mainHalfmove: number
  flipped: boolean
  warnings: string[]

  next: () => void
  prev: () => void
  jumpTo: (n: number) => void
  jumpToVariation: (path: VarStep[], varHalfmove: number) => void
  flip: () => void
  enterVariation: (index: number) => void
  exitVariation: () => void
  loadGame: (game: ParsedGame, fen?: string) => void
}

function makePlayer(game: ParsedGame, fen?: string): { player: GamePlayer; warnings: string[] } {
  const initial = fen ? Position.fromFEN(fen) : Position.starting()
  const result = buildTransitions(game, initial)
  return { player: new GamePlayer(result), warnings: result.warnings }
}

export function useChessGame(initialGame?: ParsedGame, fen?: string): ChessGameState {
  const playerRef = useRef<GamePlayer | null>(null)
  const warningsRef = useRef<string[]>([])

  if (playerRef.current === null && initialGame) {
    const { player, warnings } = makePlayer(initialGame, fen)
    playerRef.current = player
    warningsRef.current = warnings
  }

  const [halfmove, setHalfmove] = useState(0)
  const [tick, setTick] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [activeVarPath, setActiveVarPath] = useState<VarStep[]>([])

  const next = useCallback(() => {
    const p = playerRef.current
    if (!p || !p.canGoForward()) return
    p.stepForward()
    setHalfmove(p.halfmove)
  }, [])

  const prev = useCallback(() => {
    const p = playerRef.current
    if (!p || !p.canGoBackward()) return
    p.stepBackward()
    setHalfmove(p.halfmove)
  }, [])

  const jumpTo = useCallback((n: number) => {
    const p = playerRef.current
    if (!p) return
    // If clicking a main line move while in a variation, exit first
    if (p.isInVariation) {
      while (p.isInVariation) p.exitVariation()
      setActiveVarPath([])
      setTick(t => t + 1)
    }
    p.jumpTo(n)
    setHalfmove(p.halfmove)
  }, [])

  const enterVariation = useCallback((index: number) => {
    const p = playerRef.current
    if (!p) return
    p.enterVariation(index)
    setHalfmove(p.halfmove)
    setTick(t => t + 1)
  }, [])

  const exitVariation = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    while (p.isInVariation) p.exitVariation()
    setActiveVarPath([])
    setHalfmove(p.halfmove)
    setTick(t => t + 1)
  }, [])

  const jumpToVariation = useCallback((path: VarStep[], varHalfmove: number) => {
    const p = playerRef.current
    if (!p) return
    while (p.isInVariation) p.exitVariation()
    for (const step of path) {
      p.jumpTo(step.halfmove)
      p.enterVariation(step.varIndex)
    }
    p.jumpTo(varHalfmove)
    setActiveVarPath(path)
    setHalfmove(p.halfmove)
    setTick(t => t + 1)
  }, [])

  const flip = useCallback(() => setFlipped(f => !f), [])

  const loadGame = useCallback((game: ParsedGame, fenStr?: string) => {
    const { player, warnings } = makePlayer(game, fenStr)
    playerRef.current = player
    warningsRef.current = warnings
    setActiveVarPath([])
    setHalfmove(0)
    setTick(t => t + 1)
  }, [])

  const p = playerRef.current

  return {
    position: p ? p.positionAt(halfmove) : null,
    halfmove,
    totalMoves: p?.totalMoves ?? 0,
    currentSAN: p ? (halfmove > 0 ? (p.transitions[halfmove - 1]?.san ?? null) : null) : null,
    annotation: p
      ? halfmove > 0
        ? p.transitions[halfmove - 1]?.annotation
        : p.transitions[0]?.annotation
      : undefined,
    mainTransitions: p?.mainTransitions ?? [],
    transitions: p?.transitions ?? [],
    isInVariation: p?.isInVariation ?? false,
    activeVarPath,
    varHalfmove: halfmove,
    mainHalfmove: p?.mainHalfmove ?? 0,
    flipped,
    warnings: warningsRef.current,
    next,
    prev,
    jumpTo,
    jumpToVariation,
    flip,
    enterVariation,
    exitVariation,
    loadGame,
  }
}
