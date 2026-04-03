'use client'

import { useState, useCallback } from 'react'
import { Position } from '@chess/board'
import { buildTransitions, GamePlayer } from '@chess/transitions'
import type { Transition } from '@chess/types'
import type { ParsedGame } from '@chess/types'

export type ChessGameState = {
  player: GamePlayer | null
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
  /** Jump to a position in the main line, then enter a variation, then jump within it. */
  jumpToVariation: (mainHalfmove: number, variationIndex: number, varHalfmove: number) => void
  flip: () => void
  enterVariation: (index: number) => void
  exitVariation: () => void
  loadGame: (game: ParsedGame, fen?: string) => void
}

type GameState = {
  player: GamePlayer
  halfmove: number
  warnings: string[]
}

function initGameState(game: ParsedGame, fen?: string): GameState {
  const initial = fen ? Position.fromFEN(fen) : Position.starting()
  const result = buildTransitions(game, initial)
  return { player: new GamePlayer(result), halfmove: 0, warnings: result.warnings }
}

export function useChessGame(initialGame?: ParsedGame, fen?: string): ChessGameState {
  const [state, setState] = useState<GameState | null>(() =>
    initialGame ? initGameState(initialGame, fen) : null
  )
  const [flipped, setFlipped] = useState(false)

  const next = useCallback(() => {
    setState(prev => {
      if (!prev || !prev.player.canGoForward()) return prev
      prev.player.stepForward()
      return { ...prev, halfmove: prev.player.halfmove }
    })
  }, [])

  const prev = useCallback(() => {
    setState(s => {
      if (!s || !s.player.canGoBackward()) return s
      s.player.stepBackward()
      return { ...s, halfmove: s.player.halfmove }
    })
  }, [])

  const jumpTo = useCallback((n: number) => {
    setState(s => {
      if (!s) return s
      s.player.jumpTo(n)
      return { ...s, halfmove: s.player.halfmove }
    })
  }, [])

  const flip = useCallback(() => setFlipped(f => !f), [])

  const enterVariation = useCallback((index: number) => {
    setState(s => {
      if (!s) return s
      s.player.enterVariation(index)
      return { ...s, halfmove: s.player.halfmove }
    })
  }, [])

  const exitVariation = useCallback(() => {
    setState(s => {
      if (!s) return s
      s.player.exitVariation()
      return { ...s, halfmove: s.player.halfmove }
    })
  }, [])

  const jumpToVariation = useCallback((mainHalfmove: number, variationIndex: number, varHalfmove: number) => {
    setState(s => {
      if (!s) return s
      // Exit any current variation first, go to main line position, enter the variation
      while (s.player.isInVariation) s.player.exitVariation()
      s.player.jumpTo(mainHalfmove)
      s.player.enterVariation(variationIndex)
      s.player.jumpTo(varHalfmove)
      return { ...s, halfmove: s.player.halfmove }
    })
  }, [])

  const loadGame = useCallback((game: ParsedGame, fenStr?: string) => {
    setState(initGameState(game, fenStr))
  }, [])

  const player = state?.player ?? null
  const halfmove = state?.halfmove ?? 0

  return {
    player,
    position: player ? player.positionAt(halfmove) : null,
    halfmove,
    totalMoves: player?.totalMoves ?? 0,
    currentSAN: player?.currentSAN ?? null,
    annotation: player?.currentAnnotation,
    transitions: player?.transitions ?? [],
    isInVariation: player?.isInVariation ?? false,
    flipped,
    warnings: state?.warnings ?? [],
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
