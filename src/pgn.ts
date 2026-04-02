import type { ParsedGame } from './types.js'

// ── Token types ───────────────────────────────────────────────────────────────

type Token =
  | { type: 'header';   key: string; value: string }
  | { type: 'move';     san: string }
  | { type: 'annotation'; text: string }
  | { type: 'nag';      code: number }
  | { type: 'variation_start' }
  | { type: 'variation_end' }
  | { type: 'result';   value: string }

// ── Tokenizer ─────────────────────────────────────────────────────────────────

export function tokenize(pgn: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < pgn.length) {
    // Skip whitespace and move numbers (e.g. "1." "10..." "1.")
    if (/\s/.test(pgn[i]!)) { i++; continue }

    // Move numbers: digits followed by one or more dots
    if (/\d/.test(pgn[i]!)) {
      const start = i
      while (i < pgn.length && /[\d.]/.test(pgn[i]!)) i++
      // If it matched only digits with dots → move number, skip
      const s = pgn.slice(start, i)
      if (/^\d+\.+$/.test(s)) continue
      // Otherwise it might be a result (0-1, 1-0, 1/2-1/2) — rewind and fall through
      i = start
    }

    const ch = pgn[i]!

    // Header: [Key "Value"]
    if (ch === '[') {
      const end = pgn.indexOf(']', i)
      if (end === -1) { i++; continue }
      const inner = pgn.slice(i + 1, end).trim()
      const m = inner.match(/^(\w+)\s+"(.*)"$/)
      if (m) tokens.push({ type: 'header', key: m[1]!, value: m[2]! })
      i = end + 1
      continue
    }

    // Annotation: { ... } — supports escaped \} inside
    if (ch === '{') {
      i++
      let text = ''
      while (i < pgn.length) {
        if (pgn[i] === '\\' && pgn[i + 1] === '}') { text += '}'; i += 2; continue }
        if (pgn[i] === '}') { i++; break }
        text += pgn[i++]
      }
      tokens.push({ type: 'annotation', text: text.trim() })
      continue
    }

    // NAG: $n
    if (ch === '$') {
      i++
      let numStr = ''
      while (i < pgn.length && /\d/.test(pgn[i]!)) numStr += pgn[i++]
      tokens.push({ type: 'nag', code: parseInt(numStr, 10) })
      continue
    }

    // Variation start/end
    if (ch === '(') { tokens.push({ type: 'variation_start' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'variation_end' }); i++; continue }

    // Results
    if (pgn.startsWith('1-0', i))     { tokens.push({ type: 'result', value: '1-0'     }); i += 3; continue }
    if (pgn.startsWith('0-1', i))     { tokens.push({ type: 'result', value: '0-1'     }); i += 3; continue }
    if (pgn.startsWith('1/2-1/2', i)) { tokens.push({ type: 'result', value: '1/2-1/2' }); i += 7; continue }
    if (ch === '*')                   { tokens.push({ type: 'result', value: '*'        }); i++; continue }

    // SAN move: read until whitespace or special char
    if (/[a-zA-Z]/.test(ch) || ch === 'O') {
      let san = ''
      while (i < pgn.length && !/[\s\{\(\)\[\]]/.test(pgn[i]!)) {
        san += pgn[i++]
      }
      // Strip trailing annotation punctuation that got folded in (!, ?, +, #)
      // but keep them — they're valid SAN suffixes
      if (san) tokens.push({ type: 'move', san })
      continue
    }

    // Skip anything else (e.g. '%' escape lines, ';' line comments handled below)
    if (ch === ';') {
      // Line comment — skip to end of line
      while (i < pgn.length && pgn[i] !== '\n') i++
      continue
    }

    if (ch === '%') {
      while (i < pgn.length && pgn[i] !== '\n') i++
      continue
    }

    i++
  }

  return tokens
}

// ── Parser ────────────────────────────────────────────────────────────────────

const RESULT_VALUES = new Set(['1-0', '0-1', '1/2-1/2', '*'])

/** Returns true if a token looks like a valid SAN move (not a result or stray string) */
function isSANMove(san: string): boolean {
  if (RESULT_VALUES.has(san)) return false
  // Must start with a piece letter, a file letter (pawn), or O (castling)
  return /^([PNBRQK]|[a-h]|O-O)/.test(san)
}

export function parsePGN(pgn: string): ParsedGame {
  const tokens = tokenize(pgn)

  const headers: Record<string, string> = {}
  const moves: string[] = []
  const annotations: (string | undefined)[] = []

  let pendingAnnotation: string | undefined
  let halfmove = 0
  let variationDepth = 0

  for (const token of tokens) {
    switch (token.type) {
      case 'header':
        headers[token.key] = token.value
        break

      case 'annotation':
        pendingAnnotation = token.text
        break

      case 'nag':
        // NAG codes are annotation glyphs — we silently ignore them
        break

      case 'variation_start':
        variationDepth++
        break

      case 'variation_end':
        if (variationDepth > 0) variationDepth--
        break

      case 'result':
        // Nothing to do — just marks end of game
        break

      case 'move':
        if (variationDepth > 0) break  // skip moves inside variations

        if (!isSANMove(token.san)) break

        if (pendingAnnotation !== undefined) {
          annotations[halfmove] = pendingAnnotation
          pendingAnnotation = undefined
        }

        moves.push(token.san)
        halfmove++
        break
    }
  }

  // Annotation that trails the last move
  if (pendingAnnotation !== undefined) {
    annotations[halfmove] = pendingAnnotation
  }

  return { headers, moves, annotations }
}
