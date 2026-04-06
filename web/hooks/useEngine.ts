'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useSharedEngine } from './useSharedEngine'
import type { EngineEval, EngineState } from '@/lib/engine'

const DEFAULT_DEPTH = 18

export type UseEngineResult = {
  eval_: EngineEval | null
  /** Whether the current eval matches the current position (vs stale from previous). */
  evalCurrent: boolean
  state: EngineState
  enabled: boolean
  toggle: () => void
}

function isBlackToMove(fen: string): boolean {
  return fen.split(' ')[1] === 'b'
}

export function useEngine(fen: string | null): UseEngineResult {
  const { engine, ready, busy } = useSharedEngine()
  const [eval_, setEval] = useState<EngineEval | null>(null)
  const [evalFen, setEvalFen] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('jchess:engine-enabled')
      return stored !== null ? stored === 'true' : true
    } catch { return true }
  })

  // Analyze when FEN changes — debounced to avoid spamming the engine during rapid navigation
  const genRef = useRef(0)
  useEffect(() => {
    if (!engine || !ready || !enabled || !fen || busy) return

    const gen = ++genRef.current

    const timer = setTimeout(() => {
      if (gen !== genRef.current) return
      const flip = isBlackToMove(fen)
      engine.analyze(fen, DEFAULT_DEPTH, (e) => {
        if (gen !== genRef.current) return
        setEval(flip
          ? { ...e, score: -e.score, mate: e.mate !== null ? -e.mate : null }
          : e
        )
        setEvalFen(fen)
      })
    }, 250)

    return () => {
      clearTimeout(timer)
      if (!busy) engine.stop()
    }
  }, [fen, enabled, engine, ready, busy])

  const toggle = useCallback(() => {
    setEnabled(v => {
      const next = !v
      try { localStorage.setItem('jchess:engine-enabled', String(next)) } catch {}
      return next
    })
  }, [])

  const state: EngineState = !enabled ? 'idle' : !ready ? 'loading' : 'ready'

  return { eval_, evalCurrent: evalFen === fen, state, enabled, toggle }
}
