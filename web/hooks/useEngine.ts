'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { StockfishEngine } from '@/lib/engine'
import type { EngineEval, EngineState } from '@/lib/engine'

const DEFAULT_DEPTH = 18

export type UseEngineResult = {
  eval_: EngineEval | null
  state: EngineState
  enabled: boolean
  toggle: () => void
}

/**
 * Hook that manages a Stockfish engine instance.
 * Automatically analyzes the given FEN when enabled.
 */
export function useEngine(fen: string | null): UseEngineResult {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [eval_, setEval] = useState<EngineEval | null>(null)
  const [state, setState] = useState<EngineState>('idle')
  const [enabled, setEnabled] = useState(false)

  // Init/destroy engine when enabled changes
  useEffect(() => {
    if (!enabled) {
      engineRef.current?.destroy()
      engineRef.current = null
      setState('idle')
      setEval(null)
      return
    }

    const engine = new StockfishEngine()
    engineRef.current = engine
    setState('loading')

    engine.init().then(() => {
      setState('ready')
    })

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [enabled])

  // Analyze when FEN changes
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !enabled || !fen) return

    if (engine.currentState === 'loading') return

    setEval(null)
    engine.analyze(fen, DEFAULT_DEPTH, (e) => {
      setEval(e)
    })

    return () => {
      engine.stop()
    }
  }, [fen, enabled])

  const toggle = useCallback(() => {
    setEnabled(v => !v)
  }, [])

  return { eval_, state, enabled, toggle }
}
