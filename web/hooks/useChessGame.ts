'use client'

import { useRef, useState, useCallback } from 'react'
import { Position } from '@chess/board'
import { toSAN } from '@chess/movegen'
import { buildTransitions, GamePlayer } from '@chess/transitions'
import type { Transition } from '@chess/types'
import type { MoveMetadata, ParsedGame, PieceType, Square } from '@chess/types'

export type VarStep = { halfmove: number; varIndex: number }

export type ChessGameState = {
  position: Position | null
  halfmove: number
  totalMoves: number
  currentSAN: string | null
  annotation: string | undefined
  metadata: MoveMetadata | undefined
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
  removeVariation: (path: VarStep[]) => void
  makeMove: (from: Square, to: Square, promotion?: PieceType) => void
  playMoves: (sans: string[]) => void
  refresh: () => void
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

/** Trigger a re-render by bumping a counter. */
function useTick(): [number, () => void] {
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick(t => t + 1), [])
  return [tick, bump]
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
  const [tick, bumpTick] = useTick()
  const [flipped, setFlipped] = useState(false)

  /** Sync React state with player's current halfmove + force re-render. */
  const sync = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    setHalfmove(p.halfmove)
    bumpTick()
  }, [bumpTick])

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
    }
    p.jumpTo(n)
    sync()
  }, [sync])

  const enterVariation = useCallback((index: number) => {
    const p = playerRef.current
    if (!p) return
    p.enterVariation(index)
    sync()
  }, [sync])

  const exitVariation = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    while (p.isInVariation) p.exitVariation()
    sync()
  }, [sync])

  const jumpToVariation = useCallback((path: VarStep[], varHalfmove: number) => {
    const p = playerRef.current
    if (!p) return
    p.jumpToVariation(path, varHalfmove)
    sync()
  }, [sync])

  const setAnnotation = useCallback((text: string) => {
    const p = playerRef.current
    if (!p) return
    p.setAnnotation(text)
    bumpTick()
  }, [bumpTick])

  const removeVariation = useCallback((path: VarStep[]) => {
    const p = playerRef.current
    if (!p) return
    p.removeVariation(path)
    sync()
  }, [sync])

  /** Play a sequence of SAN moves from the current position (for engine PV lines). */
  const playMoves = useCallback((sans: string[]) => {
    const p = playerRef.current
    if (!p) return
    for (const san of sans) {
      if (!p.makeMove(san)) break
    }
    sync()
  }, [sync])

  const makeMove = useCallback((from: Square, to: Square, promotion?: PieceType) => {
    const p = playerRef.current
    if (!p) return
    const position = p.positionAt(p.halfmove)
    const san = toSAN(position, from, to, promotion)
    if (!san) return
    if (!p.makeMove(san)) return
    sync()
  }, [sync])

  /** Force a re-render (e.g., after external mutation of transitions). */
  const refresh = useCallback(() => bumpTick(), [bumpTick])

  const flip = useCallback(() => setFlipped(f => !f), [])

  const loadGame = useCallback((game: ParsedGame, fenStr?: string) => {
    const { player, warnings } = makePlayer(game, fenStr)
    playerRef.current = player
    warningsRef.current = warnings
    setHalfmove(0)
    bumpTick()
  }, [bumpTick])

  const p = playerRef.current

  return {
    position: p ? p.positionAt(halfmove) : null,
    halfmove,
    totalMoves: p?.totalMoves ?? 0,
    currentSAN: p?.currentSAN ?? null,
    annotation: p?.currentAnnotation,
    metadata: p?.currentMetadata,
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
    removeVariation,
    makeMove,
    playMoves,
    refresh,
    flip,
    enterVariation,
    exitVariation,
    loadGame,
  }
}
