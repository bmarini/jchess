import ecoData from './eco.json'

type ECOEntry = { eco: string; name: string }

const db = ecoData as Record<string, ECOEntry>

/**
 * Find the opening for a sequence of SAN moves.
 * Returns the longest matching opening, or null if no match.
 */
export function identifyOpening(sans: string[]): ECOEntry | null {
  let best: ECOEntry | null = null

  // Build progressively longer move strings and check for matches.
  // The longest match wins (most specific sub-variation).
  const parts: string[] = []
  for (const san of sans) {
    parts.push(san)
    const key = parts.join(' ')
    const entry = db[key]
    if (entry) best = entry
  }

  return best
}
