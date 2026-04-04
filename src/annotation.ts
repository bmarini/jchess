import type { MoveMetadata } from './types.js'

const COMMAND_RE = /\[%(\w+)\s+([^\]]+)\]/g

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
