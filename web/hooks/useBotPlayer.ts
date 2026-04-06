'use client'

import { useRef, useState, useEffect } from 'react'
import { Position } from '@chess/board'
import { StockfishEngine } from '@/lib/engine'
import type { PieceType } from '@chess/types'

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
      if (position.legalMovesFrom(f + r).length > 0) return true
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
  const engineRef = useRef<StockfishEngine | null>(null)
  const [thinking, setThinking] = useState(false)
  const [gameOver, setGameOver] = useState<GameOverState>(null)
  const genRef = useRef(0)

  // Reset game over when config changes
  useEffect(() => {
    setGameOver(null)
  }, [config?.botColor, config?.skillLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Init/destroy engine when config changes
  useEffect(() => {
    if (!config) {
      engineRef.current?.destroy()
      engineRef.current = null
      return
    }

    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.init()

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [config?.botColor, config?.skillLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check for game over + request bot move
  useEffect(() => {
    const engine = engineRef.current
    if (!config || !position || !engine || gameOver) return

    const over = detectGameOver(position)
    if (over) {
      setGameOver(over)
      return
    }

    if (position.activeColor !== config.botColor) return

    const gen = ++genRef.current
    const fen = position.toFEN()

    setThinking(true)

    const timer = setTimeout(() => {
      engine.playBotMove(fen, config.skillLevel).then((uci) => {
        if (gen !== genRef.current) return
        setThinking(false)
        if (!uci) return
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promo = uci.length > 4 ? uci[4]!.toUpperCase() as PieceType : undefined
        makeMove(from, to, promo)
      })
    }, 300)

    return () => {
      clearTimeout(timer)
      setThinking(false)
    }
  }, [config, position?.toFEN(), gameOver]) // eslint-disable-line react-hooks/exhaustive-deps

  return { thinking, gameOver }
}
