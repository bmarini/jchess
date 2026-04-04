import { serializeAnnotation } from './annotation.js'
import type { Transition } from './types.js'

/**
 * Serialize a game back to PGN text from headers, transitions, and optional pre-annotation.
 */
export function exportPGN(
  headers: Record<string, string>,
  transitions: Transition[],
  preAnnotation?: string,
): string {
  const parts: string[] = []

  // Headers
  for (const [key, value] of Object.entries(headers)) {
    parts.push(`[${key} "${value}"]`)
  }
  if (parts.length > 0) parts.push('')

  // Moves
  const moveText = serializeMoves(transitions, 1, preAnnotation)
  parts.push(moveText)

  // Result
  const result = headers['Result']
  if (result && !moveText.endsWith(result)) {
    parts.push(result)
  }

  return parts.join('\n')
}

function serializeMoves(
  transitions: Transition[],
  startHalfmove: number,
  preAnnotation?: string,
): string {
  const tokens: string[] = []

  if (preAnnotation) {
    tokens.push(`{${preAnnotation}}`)
  }

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]!
    const hm = startHalfmove + i
    const moveNum = Math.ceil(hm / 2)
    const isWhite = hm % 2 === 1

    // Move number
    if (isWhite) {
      tokens.push(`${moveNum}.`)
    } else if (i === 0 || transitions[i - 1]!.variations.length > 0 || transitions[i - 1]!.annotation || transitions[i - 1]!.metadata) {
      tokens.push(`${moveNum}...`)
    }

    // SAN
    tokens.push(t.san)

    // Annotation (re-embeds metadata commands)
    const combined = serializeAnnotation(t.annotation, t.metadata)
    if (combined) {
      tokens.push(`{${combined}}`)
    }

    // Variations
    for (const varTransitions of t.variations) {
      if (varTransitions.length === 0) continue
      const varText = serializeMoves(varTransitions, hm, undefined)
      tokens.push(`(${varText})`)
    }
  }

  return tokens.join(' ')
}
