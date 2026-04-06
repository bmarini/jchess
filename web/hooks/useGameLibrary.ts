'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { parseMultiPGN } from '@/lib/parseMultiPGN'
import { loadLibrary, saveLibrary, loadActiveState, saveActiveState } from '@/lib/storage'
import { decompressPGN, getEncodedPGNFromHash } from '@/lib/shareUrl'
import { exportPGN } from '@chess/export'
import type { GameEntry } from '@/lib/parseMultiPGN'
import type { ParsedGame, Transition } from '@chess/types'

export type UseGameLibraryResult = {
  games: GameEntry[]
  activeIndex: number
  activeGame: GameEntry | null
  loadPGN: (pgn: string) => GameEntry | null
  selectGame: (index: number) => GameEntry | null
  removeGame: (index: number) => void
  newGame: () => void
  downloadAll: () => void
  persistCurrentGame: (transitions: Transition[], game: ParsedGame) => void
  initialize: (onLoad: (game: ParsedGame) => void) => void
}

export function useGameLibrary(): UseGameLibraryResult {
  const [savedPGNs, setSavedPGNs] = useState<string[]>([])
  const [savedGames, setSavedGames] = useState<GameEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const initializedRef = useRef(false)

  const activeGame = activeIndex >= 0 ? savedGames[activeIndex] ?? null : null

  useEffect(() => {
    if (activeIndex >= 0) saveActiveState({ source: 'saved', index: activeIndex })
  }, [activeIndex])

  const loadPGN = useCallback((pgn: string): GameEntry | null => {
    const newEntries = parseMultiPGN(pgn)
    if (newEntries.length === 0) return null
    const newPGNs = newEntries.map(e => e.raw)
    let newIndex = -1
    setSavedPGNs(prev => { const next = [...prev, ...newPGNs]; saveLibrary(next); return next })
    setSavedGames(prev => { newIndex = prev.length; return [...prev, ...newEntries] })
    setActiveIndex(newIndex >= 0 ? newIndex : 0)
    return newEntries[0] ?? null
  }, [])

  const selectGame = useCallback((index: number): GameEntry | null => {
    const entry = savedGames[index]
    if (!entry) return null
    setActiveIndex(index)
    return entry
  }, [savedGames])

  const removeGame = useCallback((index: number) => {
    setSavedPGNs(prev => { const next = prev.filter((_, i) => i !== index); saveLibrary(next); return next })
    setSavedGames(prev => prev.filter((_, i) => i !== index))
    setActiveIndex(prev => {
      if (prev === index) return -1
      if (prev > index) return prev - 1
      return prev
    })
  }, [])

  const newGame = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
    const pgn = `[Event "?"]\n[Site "?"]\n[Date "${today}"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n*`
    loadPGN(pgn)
  }, [loadPGN])

  const downloadAll = useCallback(() => {
    if (savedPGNs.length === 0) return
    const allPGN = savedPGNs.join('\n\n')
    const blob = new Blob([allPGN], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jchess-games.pgn'
    a.click()
    URL.revokeObjectURL(url)
  }, [savedPGNs])

  const persistCurrentGame = useCallback((transitions: Transition[], game: ParsedGame) => {
    if (activeIndex < 0 || !game) return
    const pgn = exportPGN(game.headers, transitions, game.preAnnotation)
    setSavedPGNs(prev => {
      const next = [...prev]
      next[activeIndex] = pgn
      saveLibrary(next)
      return next
    })
  }, [activeIndex])

  const initialize = useCallback((onLoad: (game: ParsedGame) => void) => {
    if (initializedRef.current) return
    initializedRef.current = true

    const encoded = getEncodedPGNFromHash()
    if (encoded) {
      decompressPGN(encoded).then(pgn => {
        const entries = parseMultiPGN(pgn)
        if (entries.length === 0) return
        setSavedPGNs([pgn])
        setSavedGames(entries)
        setActiveIndex(0)
        saveLibrary([pgn])
        saveActiveState({ source: 'saved', index: 0 })
        onLoad(entries[0]!.game)
      }).catch(() => {})
      return
    }

    const pgns = loadLibrary()
    if (pgns.length > 0) {
      const entries = pgns.map((p) => {
        const parsed = parseMultiPGN(p)
        return parsed[0] ?? null
      }).filter((e): e is GameEntry => e !== null)
      setSavedPGNs(pgns.slice(0, entries.length))
      setSavedGames(entries)
      const active = loadActiveState()
      const idx = active?.index ?? 0
      if (idx < entries.length) {
        setActiveIndex(idx)
        onLoad(entries[idx]!.game)
      }
    }
  }, [])

  return {
    games: savedGames,
    activeIndex,
    activeGame,
    loadPGN,
    selectGame,
    removeGame,
    newGame,
    downloadAll,
    persistCurrentGame,
    initialize,
  }
}
