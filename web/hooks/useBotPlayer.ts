'use client'

import { useRef, useState, useEffect } from 'react'
import { Position } from '@chess/board'
import { legalMovesFrom } from '@chess/movegen'
import { useSharedEngine } from './useSharedEngine'
import type { PieceType, Square } from '@chess/types'

export type BotConfig = {
  botColor: 'w' | 'b'
  skillLevel: number
} | null

export type GameOverState = {
  reason: 'checkmate' | 'stalemate'
  winner: 'w' | 'b' | null
} | null

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8']

function hasAnyLegalMove(position: Position): boolean {
  for (const f of FILES) {
    for (const r of RANKS) {
      if (legalMovesFrom(position, (f + r) as Square).length > 0) return true
    }
  }
  return false
}

function detectGameOver(position: Position): GameOverState {
  if (hasAnyLegalMove(position)) return null
  const opponent = position.activeColor === 'w' ? 'b' : 'w'
  if (position.isInCheck()) {
    return { reason: 'checkmate', winner: opponent }
  }
  return { reason: 'stalemate', winner: null }
}

export function useBotPlayer(
  config: BotConfig,
  position: Position | null,
  makeMove: (from: string, to: string, promotion?: PieceType) => void,
): { thinking: boolean; gameOver: GameOverState } {
  const { engine, ready, setBusy } = useSharedEngine()
  const [thinking, setThinking] = useState(false)
  const [gameOver, setGameOver] = useState<GameOverState>(null)
  const genRef = useRef(0)

  // Reset game over when config changes
  useEffect(() => {
    setGameOver(null)
  }, [config?.botColor, config?.skillLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for game over + request bot move
  useEffect(() => {
    if (!config || !position || !engine || !ready || gameOver) return

    const over = detectGameOver(position)
    if (over) {
      setGameOver(over)
      return
    }

    if (position.activeColor !== config.botColor) return

    const gen = ++genRef.current
    const fen = position.toFEN()
    let cancelled = false

    setBusy(true)
    setThinking(true)

    const timer = setTimeout(() => {
      engine.playBotMove(fen, config.skillLevel).then((uci) => {
        if (cancelled || gen !== genRef.current) return
        setBusy(false)
        setThinking(false)
        if (!uci) return
        const from = uci.slice(0, 2) as Square
        const to = uci.slice(2, 4) as Square
        const promo = uci.length > 4 ? uci[4]!.toUpperCase() as PieceType : undefined
        makeMove(from, to, promo)
      })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      engine.stop()
      setBusy(false)
      setThinking(false)
    }
  }, [config, position?.toFEN(), gameOver, engine, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return { thinking, gameOver }
}
