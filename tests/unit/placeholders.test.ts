import { describe, expect, it } from 'vitest'
import { detect } from '../../core/detect'
import { detectTable } from '../../core/detect/table'
import { handleDetectRequest, type DetectResponse } from '../../core/detect/worker-protocol'
import { normalizeValue, PlaceholderMap, placeholderLabel, redact } from '../../core/redact/placeholders'

describe('PlaceholderMap', () => {
  it('numbers values per type in the order they are first seen', () => {
    const map = new PlaceholderMap()
    expect(map.placeholderFor('EMAIL', 'a@example.com')).toBe('[EMAIL_1]')
    expect(map.placeholderFor('IP', '192.0.2.1')).toBe('[IP_1]')
    expect(map.placeholderFor('EMAIL', 'b@example.com')).toBe('[EMAIL_2]')
  })

  it('gives the same value the same placeholder everywhere, ignoring case where it does not matter', () => {
    const map = new PlaceholderMap()
    expect(map.placeholderFor('EMAIL', 'Anna@Example.com')).toBe('[EMAIL_1]')
    expect(map.placeholderFor('EMAIL', 'anna@example.com')).toBe('[EMAIL_1]')
    expect(map.placeholderFor('URL', 'HTTPS://Example.com/Invoice/7')).toBe('[LINK_1]')
    expect(map.placeholderFor('URL', 'https://example.com/Invoice/7')).toBe('[LINK_1]')
    expect(map.size).toBe(2)
  })

  it('labels links as LINK and everything else by its type', () => {
    expect(placeholderLabel('URL')).toBe('LINK')
    expect(placeholderLabel('EMAIL')).toBe('EMAIL')
  })

  it('keeps URL paths case-sensitive, since they can point to different things', () => {
    expect(normalizeValue('URL', 'https://example.com/A')).not.toBe(normalizeValue('URL', 'https://example.com/a'))
  })
})

describe('redact', () => {
  it('replaces every detection and keeps the rest of the text', () => {
    const text = 'Mail anna@example.com or ANNA@example.com, IP 192.0.2.9.'
    expect(redact(text, detect(text), new PlaceholderMap())).toBe('Mail [EMAIL_1] or [EMAIL_1], IP [IP_1].')
  })

  it('continues numbering across cells when one map is shared', () => {
    const map = new PlaceholderMap()
    const first = 'Von a@example.com'
    const second = 'Von b@example.com und a@example.com'
    expect(redact(first, detect(first), map)).toBe('Von [EMAIL_1]')
    expect(redact(second, detect(second), map)).toBe('Von [EMAIL_2] und [EMAIL_1]')
  })

  it('refuses overlapping detections', () => {
    const overlapping = [
      { type: 'EMAIL' as const, start: 0, end: 5, value: 'aaaaa' },
      { type: 'URL' as const, start: 3, end: 8, value: 'aaaaa' },
    ]
    expect(() => redact('aaaaaaaa', overlapping, new PlaceholderMap())).toThrow()
  })
})

describe('detectTable', () => {
  const rows = [
    ['1', 'a@example.com', 'kept@example.com'],
    ['2', 'nothing here', ''],
    ['3', 'IP 192.0.2.1', ''],
  ]

  it('scans only the chosen columns and returns only cells with detections', () => {
    expect(detectTable(rows, [1]).map(({ row, column }) => [row, column])).toEqual([[0, 1], [2, 1]])
  })

  it('reports progress per batch and at the end', () => {
    const progress: number[] = []
    detectTable(rows, [1], { batchSize: 2, onProgress: done => progress.push(done) })
    expect(progress).toEqual([2, 3])
  })
})

describe('detection worker protocol', () => {
  it('sends progress, then the result, tagged with the request id', () => {
    const sent: DetectResponse[] = []
    handleDetectRequest({ kind: 'detect', id: 7, rows: [['a@example.com']], columns: [0] }, response => sent.push(response))
    expect(sent.map(response => response.kind)).toEqual(['progress', 'result'])
    expect(sent.every(response => response.id === 7)).toBe(true)
    const result = sent.at(-1)!
    expect(result.kind === 'result' && result.cells[0]!.detections[0]!.value).toBe('a@example.com')
  })

  it('surveys columns as counts per type, without any values', () => {
    const sent: DetectResponse[] = []
    const rows = [['a@example.com, b@example.com', '+43 660 234 2972'], ['c@example.com', 'nothing here']]
    handleDetectRequest({ kind: 'survey', id: 3, rows, columns: [0, 1] }, response => sent.push(response))
    expect(sent.at(-1)).toEqual({ kind: 'survey', id: 3, columns: [{ column: 0, counts: { EMAIL: 3 } }, { column: 1, counts: { PHONE: 1 } }] })
    expect(JSON.stringify(sent)).not.toContain('example.com')
  })

  it('reports a failure without echoing the text that was scanned', () => {
    const sent: DetectResponse[] = []
    const broken = { kind: 'detect' as const, id: 1, rows: null as unknown as string[][], columns: [0] }
    handleDetectRequest(broken, response => sent.push(response))
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ kind: 'error', id: 1 })
  })
})
