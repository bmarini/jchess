'use client'

import { useRef, useState, useCallback } from 'react'
import { Position } from '@chess/board'
import { toSAN } from '@chess/moves'
import { buildTransitions, GamePlayer } from '@chess/transitions'
import type { Transition } from '@chess/types'
import type { ParsedGame, PieceType, Square } from '@chess/types'

export type VarStep = { halfmove: number; varIndex: number }

export type ChessGameState = {
  position: Position | null
  halfmove: number
  totalMoves: number
  currentSAN: string | null
  annotation: string | undefined
  mainTransitions: Transition[]
  transitions: Transition[]
  isInVariation: boolean
  activeVarPath: VarStep[]
  varHalfmove: number
  mainHalfmove: number
  flipped: boolean
  warnings: string[]

  next: () => void
  prev: () => void
  jumpTo: (n: number) => void
  jumpToVariation: (path: VarStep[], varHalfmove: number) => void
  setAnnotation: (text: string) => void
  makeMove: (from: Square, to: Square, promotion?: PieceType) => void
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
    if (p.isInVariation) {
      while (p.isInVariation) p.exitVariation()
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

  const setAnnotation = useCallback((text: string) => {
    const p = playerRef.current
    if (!p || halfmove === 0) return
    const t = p.transitions[halfmove - 1]
    if (!t) return
    t.annotation = text || undefined
    setTick(t => t + 1)
  }, [halfmove])

  const makeMove = useCallback((from: Square, to: Square, promotion?: PieceType) => {
    const p = playerRef.current
    if (!p) return
    const position = p.positionAt(p.halfmove)
    const san = toSAN(position, from, to, promotion)
    if (!san) return
    const cmds = p.makeMove(san)
    if (!cmds) return
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
    mainTransitions: p?.mainTransitions ?? [],
    transitions: p?.transitions ?? [],
    isInVariation: p?.isInVariation ?? false,
    activeVarPath: p?.variationPath ?? [],
    varHalfmove: halfmove,
    mainHalfmove: p?.mainHalfmove ?? 0,
    flipped,
    warnings: warningsRef.current,
    next,
    prev,
    jumpTo,
    jumpToVariation,
    setAnnotation,
    makeMove,
    flip,
    enterVariation,
    exitVariation,
    loadGame,
  }
}
