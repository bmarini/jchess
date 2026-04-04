const LIBRARY_KEY = 'jchess:library'
const ACTIVE_KEY = 'jchess:active'

export type ActiveState = {
  source: 'saved' | 'example'
  index: number
}

export function loadLibrary(): string[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLibrary(games: string[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(games))
  } catch {
    // Quota exceeded or unavailable — silently ignore
  }
}

export function loadActiveState(): ActiveState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActiveState
  } catch {
    return null
  }
}

export function saveActiveState(state: ActiveState): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(state))
  } catch {
    // Silently ignore
  }
}
