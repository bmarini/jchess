import { describe, it, expect } from 'vitest'
import { parsePGN, tokenize } from './pgn.js'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadExample(name: string): string {
  return readFileSync(join(__dirname, '..', 'examples', name), 'utf-8')
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('parses a header', () => {
    const tokens = tokenize('[White "Fischer"]')
    expect(tokens).toContainEqual({ type: 'header', key: 'White', value: 'Fischer' })
  })

  it('parses moves and move numbers', () => {
    const tokens = tokenize('1. e4 e5 2. Nf3')
    const moves = tokens.filter(t => t.type === 'move').map(t => (t as any).san)
    expect(moves).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('parses an annotation', () => {
    const tokens = tokenize('3.Bb5 {This is the Ruy Lopez.}')
    const ann = tokens.find(t => t.type === 'annotation')
    expect((ann as any).text).toBe('This is the Ruy Lopez.')
  })

  it('parses castling as a move', () => {
    const tokens = tokenize('5.O-O O-O-O')
    const moves = tokens.filter(t => t.type === 'move').map(t => (t as any).san)
    expect(moves).toEqual(['O-O', 'O-O-O'])
  })

  it('parses a result token', () => {
    const tokens = tokenize('1-0')
    expect(tokens).toContainEqual({ type: 'result', value: '1-0' })
  })

  it('parses 1/2-1/2 result', () => {
    const tokens = tokenize('1/2-1/2')
    expect(tokens).toContainEqual({ type: 'result', value: '1/2-1/2' })
  })

  it('parses NAG codes', () => {
    const tokens = tokenize('e4 $1 e5 $2')
    const nags = tokens.filter(t => t.type === 'nag').map(t => (t as any).code)
    expect(nags).toEqual([1, 2])
  })

  it('parses variation start/end', () => {
    const tokens = tokenize('e4 (d4) e5')
    const types = tokens.map(t => t.type)
    expect(types).toContain('variation_start')
    expect(types).toContain('variation_end')
  })

  it('handles annotation with escaped braces', () => {
    const tokens = tokenize('{this has a \\} inside}')
    const ann = tokens.find(t => t.type === 'annotation')
    expect((ann as any).text).toBe('this has a } inside')
  })

  it('handles move directly followed by annotation (no space)', () => {
    const tokens = tokenize('7. Nf3{annotation here}')
    const moves = tokens.filter(t => t.type === 'move').map(t => (t as any).san)
    expect(moves).toEqual(['Nf3'])
    const ann = tokens.find(t => t.type === 'annotation')
    expect((ann as any).text).toBe('annotation here')
  })
})

// ── Parser ────────────────────────────────────────────────────────────────────

describe('parsePGN – basics', () => {
  it('parses headers', () => {
    const game = parsePGN('[White "Fischer"] [Black "Spassky"] 1. e4 e5')
    expect(game.headers['White']).toBe('Fischer')
    expect(game.headers['Black']).toBe('Spassky')
  })

  it('parses moves', () => {
    const game = parsePGN('1. e4 e5 2. Nf3 Nc6')
    expect(game.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
  })

  it('attaches annotation to next move (before the move)', () => {
    const game = parsePGN('1. e4 {great move} e5')
    // annotation is attached at halfmove 1 (after e4, before e5)
    expect(game.annotations[1]).toBe('great move')
  })

  it('skips moves inside variations', () => {
    const game = parsePGN('1. e4 (1. d4 d5) e5')
    expect(game.moves).toEqual(['e4', 'e5'])
  })

  it('handles result tokens without crashing', () => {
    expect(() => parsePGN('1. e4 e5 1-0')).not.toThrow()
  })

  it('handles * result', () => {
    expect(() => parsePGN('1. Nc3 Nf6 *')).not.toThrow()
  })
})

// ── Demo games ────────────────────────────────────────────────────────────────

describe('fischer-spassky', () => {
  const game = parsePGN(loadExample('fischer-spassky.pgn'))

  it('parses headers', () => {
    expect(game.headers['White']).toBe('Fischer, Robert J.')
    expect(game.headers['Black']).toBe('Spassky, Boris V.')
    expect(game.headers['Result']).toBe('1/2-1/2')
  })

  it('has 85 half-moves', () => {
    expect(game.moves).toHaveLength(85)
  })

  it('first move is e4', () => {
    expect(game.moves[0]).toBe('e4')
  })

  it('last move is Re6', () => {
    expect(game.moves[84]).toBe('Re6')
  })

  it('has annotation on move 3 (Bb5)', () => {
    // Bb5 is halfmove 4 (0-based), annotation is attached at halfmove 5
    const annotatedIdx = game.annotations.findIndex(a => a !== undefined)
    expect(game.annotations[annotatedIdx]).toContain('Ruy Lopez')
  })
})

describe('justdoeet', () => {
  const game = parsePGN(loadExample('justdoeet.pgn'))

  it('has 71 half-moves', () => {
    expect(game.moves).toHaveLength(71)
  })

  it('last move is Qxh7#', () => {
    expect(game.moves[70]).toBe('Qxh7#')
  })
})

describe('with-queening', () => {
  const game = parsePGN(loadExample('with-queening.pgn'))

  it('has 253 half-moves', () => {
    expect(game.moves).toHaveLength(253)
  })

  it('contains a8=Q (white queens)', () => {
    expect(game.moves).toContain('a8=Q')
  })

  it('contains g1=Q (black queens)', () => {
    expect(game.moves).toContain('g1=Q')
  })
})

describe('unambiguous-knight', () => {
  const game = parsePGN(loadExample('unambiguous-knight.pgn'))

  it('has 23 half-moves', () => {
    expect(game.moves).toHaveLength(23)
  })

  it('first move is Nc3 (not e4 or d4)', () => {
    expect(game.moves[0]).toBe('Nc3')
  })
})

describe('heavily-annotated', () => {
  const game = parsePGN(loadExample('heavily-annotated.pgn'))

  it('has 72 half-moves', () => {
    expect(game.moves).toHaveLength(72)
  })

  it('has many annotations', () => {
    const annCount = game.annotations.filter(a => a !== undefined).length
    expect(annCount).toBeGreaterThan(20)
  })

  it('handles annotation immediately after move (no space)', () => {
    // move 13 "Nf3" is followed directly by { without space
    expect(game.moves[12]).toBe('Nf3')
  })
})

describe('middle-game', () => {
  const game = parsePGN(loadExample('middle-game.pgn'))

  it('has 58 half-moves', () => {
    expect(game.moves).toHaveLength(58)
  })

  it('last move is Qxe1#', () => {
    expect(game.moves[57]).toBe('Qxe1#')
  })
})

// ── Edge cases that broke the old parser ─────────────────────────────────────

describe('edge cases', () => {
  it('handles game starting with 1.a4 (old parser would crash)', () => {
    const game = parsePGN('1.a4 a5 2.b4 b5')
    expect(game.moves[0]).toBe('a4')
    expect(game.moves).toHaveLength(4)
  })

  it('handles game starting with 1.Na3', () => {
    const game = parsePGN('1.Na3 Nf6 2.Nc4')
    expect(game.moves[0]).toBe('Na3')
  })

  it('handles game starting with 1.h4', () => {
    const game = parsePGN('1.h4 h5 2.g4')
    expect(game.moves[0]).toBe('h4')
  })

  it('handles promotion notation', () => {
    const game = parsePGN('1.e4 e5 2.a4 a5 55.a8=Q')
    expect(game.moves).toContain('a8=Q')
  })

  it('does not include result tokens as moves', () => {
    const game = parsePGN('1. e4 e5 1-0')
    expect(game.moves).not.toContain('1-0')
  })

  it('does not include 0-1 as a move', () => {
    const game = parsePGN('1. d4 d5 0-1')
    expect(game.moves).not.toContain('0-1')
  })

  it('handles deeply nested variations without crashing', () => {
    expect(() => parsePGN('1.e4 (1.d4 (1.c4 c5) d5) e5')).not.toThrow()
  })
})
