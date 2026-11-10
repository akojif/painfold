import { describe, expect, it } from 'vitest'
import { chunkText, mergeOverlapping } from '../../core/detect/chunks'

const fitsIn = (limit: number) => (text: string) => text.length <= limit

describe('chunkText', () => {
  it('keeps a text that fits as one chunk', () => {
    expect(chunkText('Kurz und gut.', fitsIn(100))).toEqual([{ start: 0, end: 13 }])
  })

  it('cuts at sentence ends, each chunk fits, and each starts with the last sentence of the one before', () => {
    const text = 'Erster Satz hier. Zweiter Satz da. Dritter Satz dort. Vierter Satz noch.'
    const chunks = chunkText(text, fitsIn(40))
    for (const chunk of chunks) expect(chunk.end - chunk.start).toBeLessThanOrEqual(40)
    expect(chunks[0]!.start).toBe(0)
    expect(chunks.at(-1)!.end).toBe(text.length)
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeLessThan(chunks[i - 1]!.end)
    expect(chunks.map(chunk => text.slice(chunk.start, chunk.end).trim())).toEqual(['Erster Satz hier. Zweiter Satz da.', 'Zweiter Satz da. Dritter Satz dort.', 'Dritter Satz dort. Vierter Satz noch.'])
  })

  it('prefers paragraph breaks, and cuts a sentence too long on its own between words', () => {
    const text = 'Absatz eins.\n\nein sehr langer Satz ohne jedes Satzzeichen der einfach immer weiter geht'
    const chunks = chunkText(text, fitsIn(30))
    for (const chunk of chunks) expect(chunk.end - chunk.start).toBeLessThanOrEqual(30)
    // Every cut is at a space, so no word is split.
    for (const chunk of chunks) {
      expect(chunk.start === 0 || /\s/.test(text[chunk.start - 1]!)).toBe(true)
    }
    expect(chunks.at(-1)!.end).toBe(text.length)
  })
})

describe('mergeOverlapping', () => {
  const text = 'Danke an Anna Huber aus Wien.'
  it('merges a name found twice in the overlap into one', () => {
    expect(mergeOverlapping(text, [
      { type: 'NAME', start: 9, end: 19, value: 'Anna Huber' },
      { type: 'NAME', start: 9, end: 13, value: 'Anna' },
      { type: 'PLACE', start: 24, end: 28, value: 'Wien' },
    ])).toEqual([{ type: 'NAME', start: 9, end: 19, value: 'Anna Huber' }, { type: 'PLACE', start: 24, end: 28, value: 'Wien' }])
  })

  it('covers both parts when two chunks saw a name differently, with the longer one\'s type', () => {
    expect(mergeOverlapping(text, [
      { type: 'PLACE', start: 9, end: 13, value: 'Anna' },
      { type: 'NAME', start: 9, end: 19, value: 'Anna Huber' },
    ])).toEqual([{ type: 'NAME', start: 9, end: 19, value: 'Anna Huber' }])
  })
})
