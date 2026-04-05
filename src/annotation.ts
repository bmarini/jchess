import type { MoveMetadata } from './types.js'

const COMMAND_RE = /\[%(\w+)\s+([^\]]+)\]/g

/** NAG symbols in order from longest to shortest (so ?? matches before ?). */
const NAG_SYMBOLS = ['??', '!!', '?!', '!?', '?', '!'] as const
export type NAGSymbol = typeof NAG_SYMBOLS[number]

/**
 * Extract a leading NAG symbol (?, ??, ?!, !?, !, !!) from an annotation.
 * Returns the symbol and the remaining text.
 */
export function extractNAG(annotation?: string): { nag: NAGSymbol | null; text: string | undefined } {
  if (!annotation) return { nag: null, text: undefined }
  const trimmed = annotation.trimStart()
  for (const sym of NAG_SYMBOLS) {
    if (trimmed.startsWith(sym)) {
      const rest = trimmed.slice(sym.length).trim()
      return { nag: sym, text: rest || undefined }
    }
  }
  return { nag: null, text: annotation }
}

/**
 * Split a raw PGN annotation into display text and structured metadata.
 * Metadata commands like [%clk 0:30:00] are extracted; remaining text is trimmed.
 */
export function parseAnnotation(raw: string): { text: string; metadata: MoveMetadata } {
  const metadata: MoveMetadata = {}
  const text = raw.replace(COMMAND_RE, (_, key: string, value: string) => {
    metadata[key] = value.trim()
    return ''
  }).trim()
  return { text: text || undefined!, metadata }
}

/**
 * Re-embed metadata commands into an annotation string for PGN export.
 * Metadata commands come first, followed by the display text.
 */
export function serializeAnnotation(text?: string, metadata?: MoveMetadata): string | undefined {
  const parts: string[] = []

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        parts.push(`[%${key} ${value}]`)
      }
    }
  }

  if (text) {
    parts.push(text)
  }

  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Returns true if the annotation has display text (not just metadata).
 */
export function hasDisplayText(raw?: string): boolean {
  if (!raw) return false
  const stripped = raw.replace(COMMAND_RE, '').trim()
  return stripped.length > 0
}
