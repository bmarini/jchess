'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Position } from '@chess/board'
import { analyzeGame } from '@/lib/analyze'
import { useSharedEngine } from './useSharedEngine'
import type { AnalysisProgress } from '@/lib/analyze'
import type { Transition } from '@chess/types'

export type { AnalysisProgress }

type AnalysisState = 'idle' | 'running'

type UseAnalysisResult = {
  progress: AnalysisProgress | null
  state: AnalysisState
  run: (
    transitions: Transition[],
    onComplete: (result: { whiteAccuracy: number; blackAccuracy: number }) => void,
  ) => void
  cancel: () => void
}

/**
 * Manages full-game analysis lifecycle using the shared engine.
 *
 * - Sets busy=true on the shared engine during analysis (pauses live eval).
 * - Only one analysis runs at a time — calling `run` while running cancels the previous.
 * - Unmounting cancels automatically.
 * - Progress resets to null when analysis finishes or is cancelled.
 */
export function useAnalysis(): UseAnalysisResult {
  const { engine, ready, setBusy } = useSharedEngine()
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    setProgress(null)
  }, [setBusy])

  // Clean up on unmount
  useEffect(() => cancel, [cancel])

  const run = useCallback((
    transitions: Transition[],
    onComplete: (result: { whiteAccuracy: number; blackAccuracy: number }) => void,
  ) => {
    if (!engine || !ready) return

    // Cancel any in-flight analysis
    cancel()

    if (transitions.length === 0) return

    // Pre-compute positions
    const positions: Position[] = [Position.starting()]
    let pos = positions[0]!
    for (const t of transitions) {
      const result = pos.applyMove(t.san)
      if (result) pos = result.position
      positions.push(pos)
    }

    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    setProgress({ current: 0, total: transitions.length })

    analyzeGame(
      engine,
      transitions,
      (n) => positions[n]!,
      (p) => {
        if (!controller.signal.aborted) setProgress(p)
      },
      controller.signal,
    ).then((result) => {
      if (!controller.signal.aborted) {
        onComplete(result)
      }
    }).finally(() => {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
        setProgress(null)
      }
    })
  }, [cancel, engine, ready, setBusy])

  const state: AnalysisState = progress !== null ? 'running' : 'idle'

  return { progress, state, run, cancel }
}
