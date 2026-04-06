'use client'

import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { StockfishEngine } from '@/lib/engine'

type SharedEngineContextValue = {
  engine: StockfishEngine | null
  ready: boolean
  /** True when a batch operation (analysis or bot move) needs exclusive access. */
  busy: boolean
  setBusy: (busy: boolean) => void
}

const SharedEngineContext = createContext<SharedEngineContextValue>({
  engine: null,
  ready: false,
  busy: false,
  setBusy: () => {},
})

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<StockfishEngine | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusyState] = useState(false)

  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.init().then(() => setReady(true))
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  const setBusy = useCallback((b: boolean) => {
    if (b) engineRef.current?.stop()
    setBusyState(b)
  }, [])

  return (
    <SharedEngineContext.Provider value={{ engine: engineRef.current, ready, busy, setBusy }}>
      {children}
    </SharedEngineContext.Provider>
  )
}

export function useSharedEngine(): SharedEngineContextValue {
  return useContext(SharedEngineContext)
}
