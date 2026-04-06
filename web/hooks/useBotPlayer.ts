'use client'

import { useRef, useState, useEffect } from 'react'
import { StockfishEngine } from '@/lib/engine'
import type { Position } from '@chess/board'
import type { PieceType } from '@chess/types'

export type BotConfig = {
  botColor: 'w' | 'b'
  skillLevel: number
} | null

export function useBotPlayer(
  config: BotConfig,
  position: Position | null,
  makeMove: (from: string, to: string, promotion?: PieceType) => void,
): { thinking: boolean } {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [thinking, setThinking] = useState(false)
  const genRef = useRef(0)

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

  // Request bot move when it's the bot's turn
  useEffect(() => {
    const engine = engineRef.current
    if (!config || !position || !engine) return
    if (position.activeColor !== config.botColor) return

    const gen = ++genRef.current
    const fen = position.toFEN()

    setThinking(true)

    // Small delay so the human's move animates first
    const timer = setTimeout(() => {
      engine.playBotMove(fen, config.skillLevel).then((uci) => {
        if (gen !== genRef.current) return // stale
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
  }, [config, position?.toFEN()]) // eslint-disable-line react-hooks/exhaustive-deps

  return { thinking }
}
