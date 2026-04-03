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
  transitions: Transition[]
  isInVariation: boolean
  flipped: boolean
  warnings: string[]

  next: () => void
  prev: () => void
  jumpTo: (n: number) => void
  /** Jump into a variation (possibly nested) by following a path of steps from the main line. */
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
  // Player lives in a ref — it's mutable, not React-managed state.
  // We drive re-renders via halfmove + tick below.
  const playerRef = useRef<GamePlayer | null>(null)
  const warningsRef = useRef<string[]>([])

  // Initialize synchronously on first render. The `if` guard ensures this
  // runs only once even under React Strict Mode's double-invoke of the component body.
  if (playerRef.current === null && initialGame) {
    const { player, warnings } = makePlayer(initialGame, fen)
    playerRef.current = player
    warningsRef.current = warnings
  }

  // halfmove is React state — changing it triggers a re-render.
  const [halfmove, setHalfmove] = useState(0)
  // tick forces a re-render when variation stack changes (isInVariation, transitions).
  const [tick, setTick] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // All callbacks mutate playerRef.current directly (not inside a setState updater).
  // React Strict Mode only double-invokes updater functions — callbacks are safe.

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
    p.exitVariation()
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
    setHalfmove(p.halfmove)
    setTick(t => t + 1)
  }, [])

  const flip = useCallback(() => setFlipped(f => !f), [])

  const loadGame = useCallback((game: ParsedGame, fenStr?: string) => {
    const { player, warnings } = makePlayer(game, fenStr)
    playerRef.current = player
    warningsRef.current = warnings
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
    transitions: p?.transitions ?? [],
    isInVariation: p?.isInVariation ?? false,
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
