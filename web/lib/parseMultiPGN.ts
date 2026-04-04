import { parsePGN } from '@chess/pgn'
import type { ParsedGame } from '@chess/types'

export type GameEntry = {
  raw: string
  game: ParsedGame
  index: number
  /** Display label: "White vs Black" or fallback to "Game N" */
  label: string
  result: string
}

/**
 * Split a PGN string that may contain multiple games and parse each one.
 * Games are separated by a blank line followed by a new header tag.
 */
export function parseMultiPGN(pgn: string): GameEntry[] {
  const gameStrings = splitGames(pgn)
  const entries: GameEntry[] = []

  for (let i = 0; i < gameStrings.length; i++) {
    const raw = gameStrings[i]!
    try {
      const game = parsePGN(raw)
      const white = game.headers['White'] ?? '?'
      const black = game.headers['Black'] ?? '?'
      const result = game.headers['Result'] ?? '*'
      const label =
        white !== '?' || black !== '?'
          ? `${white} vs ${black}`
          : `Game ${i + 1}`
      entries.push({ raw, game, index: i, label, result })
    } catch {
      // Skip unparseable games
    }
  }

  return entries
}

function splitGames(pgn: string): string[] {
  if (!pgn) return []
  const lines = pgn.split('\n')
  const games: string[] = []
  let current: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()

    // A blank line followed by a header tag means a new game is starting
    if (trimmed === '' && current.length > 0) {
      // Peek ahead to see if the next non-empty line is a header
      let j = i + 1
      while (j < lines.length && lines[j]!.trim() === '') j++
      if (j < lines.length && lines[j]!.trim().startsWith('[')) {
        // Save current game and start new one
        const gameText = current.join('\n').trim()
        if (gameText) games.push(gameText)
        current = []
        continue
      }
    }

    current.push(line)
  }

  const last = current.join('\n').trim()
  if (last) games.push(last)

  return games.length > 0 ? games : [pgn]
}
