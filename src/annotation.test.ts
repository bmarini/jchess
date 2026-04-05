import { describe, it, expect } from 'vitest'
import { parseAnnotation, serializeAnnotation, hasDisplayText, extractNAG } from './annotation.js'

describe('parseAnnotation', () => {
  it('extracts clock metadata', () => {
    const { text, metadata } = parseAnnotation('[%clk 0:30:00]')
    expect(text).toBeFalsy()
    expect(metadata.clk).toBe('0:30:00')
  })

  it('extracts metadata and preserves display text', () => {
    const { text, metadata } = parseAnnotation('[%clk 0:29:46.1] A good move')
    expect(text).toBe('A good move')
    expect(metadata.clk).toBe('0:29:46.1')
  })

  it('handles multiple metadata commands', () => {
    const { text, metadata } = parseAnnotation('[%clk 0:15:00] [%eval +1.5] Interesting position')
    expect(text).toBe('Interesting position')
    expect(metadata.clk).toBe('0:15:00')
    expect(metadata.eval).toBe('+1.5')
  })

  it('handles annotation with no metadata', () => {
    const { text, metadata } = parseAnnotation('This is the Ruy Lopez.')
    expect(text).toBe('This is the Ruy Lopez.')
    expect(Object.keys(metadata)).toHaveLength(0)
  })

  it('handles chess.com c_effect metadata', () => {
    const raw = '[%c_effect g8;square;g8;type;Winner;animated;true]'
    const { metadata } = parseAnnotation(raw)
    expect(metadata.c_effect).toContain('g8')
  })
})

describe('serializeAnnotation', () => {
  it('embeds metadata commands', () => {
    const result = serializeAnnotation(undefined, { clk: '0:30:00' })
    expect(result).toBe('[%clk 0:30:00]')
  })

  it('combines metadata and text', () => {
    const result = serializeAnnotation('A good move', { clk: '0:29:46.1' })
    expect(result).toBe('[%clk 0:29:46.1] A good move')
  })

  it('returns undefined when empty', () => {
    expect(serializeAnnotation(undefined, undefined)).toBeUndefined()
    expect(serializeAnnotation(undefined, {})).toBeUndefined()
  })

  it('returns just text when no metadata', () => {
    expect(serializeAnnotation('Nice move')).toBe('Nice move')
  })
})

describe('hasDisplayText', () => {
  it('returns false for metadata-only annotation', () => {
    expect(hasDisplayText('[%clk 0:30:00]')).toBe(false)
  })

  it('returns true for annotation with text', () => {
    expect(hasDisplayText('[%clk 0:30:00] A good move')).toBe(true)
  })

  it('returns true for plain text', () => {
    expect(hasDisplayText('A good move')).toBe(true)
  })

  it('returns false for undefined', () => {
    expect(hasDisplayText(undefined)).toBe(false)
  })
})

describe('extractNAG', () => {
  it('extracts ?? from blunder annotation', () => {
    expect(extractNAG('??')).toEqual({ nag: '??', text: undefined })
  })

  it('extracts ? with remaining text', () => {
    expect(extractNAG('? This was a mistake')).toEqual({ nag: '?', text: 'This was a mistake' })
  })

  it('extracts ?! dubious', () => {
    expect(extractNAG('?!')).toEqual({ nag: '?!', text: undefined })
  })

  it('extracts ! good move', () => {
    expect(extractNAG('! Great find')).toEqual({ nag: '!', text: 'Great find' })
  })

  it('extracts !! brilliant', () => {
    expect(extractNAG('!!')).toEqual({ nag: '!!', text: undefined })
  })

  it('extracts !? interesting', () => {
    expect(extractNAG('!?')).toEqual({ nag: '!?', text: undefined })
  })

  it('returns null nag for plain text', () => {
    expect(extractNAG('A normal annotation')).toEqual({ nag: null, text: 'A normal annotation' })
  })

  it('returns null nag for undefined', () => {
    expect(extractNAG(undefined)).toEqual({ nag: null, text: undefined })
  })

  it('prefers ?? over ?', () => {
    expect(extractNAG('?? terrible')).toEqual({ nag: '??', text: 'terrible' })
  })
})
