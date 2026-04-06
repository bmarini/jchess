'use client'

import { useState, useCallback } from 'react'
import { exportPGN } from '@chess/export'
import { compressPGN, buildShareUrl } from '@/lib/shareUrl'
import type { ParsedGame, Transition } from '@chess/types'

export type UseGameActionsResult = {
  handleShare: () => Promise<void>
  handleCopyPGN: () => Promise<void>
  handleDownloadPGN: () => void
  shareStatus: 'idle' | 'copied'
  copyStatus: 'idle' | 'copied'
}

export function useGameActions(
  game: ParsedGame | undefined,
  mainTransitions: Transition[],
): UseGameActionsResult {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')

  const handleShare = useCallback(async () => {
    if (!game) return
    const pgn = exportPGN(game.headers, mainTransitions, game.preAnnotation)
    const encoded = await compressPGN(pgn)
    const url = buildShareUrl(encoded)
    window.history.replaceState(null, '', url)
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }, [game, mainTransitions])

  const handleCopyPGN = useCallback(async () => {
    if (!game) return
    const pgn = exportPGN(game.headers, mainTransitions, game.preAnnotation)
    await navigator.clipboard.writeText(pgn)
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 2000)
  }, [game, mainTransitions])

  const handleDownloadPGN = useCallback(() => {
    if (!game) return
    const pgn = exportPGN(game.headers, mainTransitions, game.preAnnotation)
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const w = game.headers['White'] ?? 'game'
    const b = game.headers['Black'] ?? ''
    a.download = b ? `${w}-vs-${b}.pgn` : `${w}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }, [game, mainTransitions])

  return { handleShare, handleCopyPGN, handleDownloadPGN, shareStatus, copyStatus }
}
