import ecoData from './eco.json'

type ECOEntry = { eco: string; name: string }

const db = ecoData as Record<string, ECOEntry>

export type OpeningInfo = {
  eco: string
  name: string
  /** Halfmove (1-indexed) of the last move that's still in book. Moves after this are off book. */
  lastBookMove: number
}

/**
 * Identify the opening and where the game leaves book.
 * Returns the longest matching opening and the halfmove of the last book move.
 */
export function identifyOpening(sans: string[]): OpeningInfo | null {
  let best: OpeningInfo | null = null

  const parts: string[] = []
  for (let i = 0; i < sans.length; i++) {
    parts.push(sans[i]!)
    const key = parts.join(' ')
    const entry = db[key]
    if (entry) {
      best = { eco: entry.eco, name: entry.name, lastBookMove: i + 1 }
    }
  }

  return best
}
