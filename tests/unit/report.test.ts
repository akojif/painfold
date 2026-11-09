import { describe, expect, it } from 'vitest'
import { cleaningReport, reportTimestamp, wrap } from '../../core/export/report'

describe('cleaningReport', () => {
  const input = {
    title: 'Painfold cleaning report',
    details: [['Original file', 'tickets.csv'], ['Painfold version', '0.1.0']] as [string, string][],
    removedHeading: 'Replaced with placeholders',
    removed: [['Email addresses', '14'], ['IP addresses', '9']] as [string, string][],
    nothingRemoved: 'Nothing was found or marked.',
    notes: ['Includes 3 findings that were not reviewed.'],
    limitsHeading: 'Limits',
    limits: 'Automatic detection can miss personal data. Review the results before sharing the cleaned file.',
  }

  it('lays out details, removals, notes and the limits as plain text with CRLF', () => {
    expect(cleaningReport(input).split('\r\n')).toEqual([
      'Painfold cleaning report',
      '-'.repeat(60),
      'Original file     tickets.csv',
      'Painfold version  0.1.0',
      '',
      'Replaced with placeholders',
      '  Email addresses  14',
      '  IP addresses     9',
      '',
      'Includes 3 findings that were not reviewed.',
      '',
      'Limits',
      'Automatic detection can miss personal data. Review the results before',
      'sharing the cleaned file.',
      '',
    ])
  })

  it('says so when nothing was replaced', () => {
    expect(cleaningReport({ ...input, removed: [], notes: [] })).toContain('Replaced with placeholders\r\n  Nothing was found or marked.\r\n')
  })
})

describe('wrap', () => {
  it('breaks at word boundaries within the width', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four'])
  })

  it('keeps a word longer than the width on its own line', () => {
    expect(wrap('a verylongword b', 5)).toEqual(['a', 'verylongword', 'b'])
  })
})

describe('reportTimestamp', () => {
  it('gives local date and time with the UTC offset', () => {
    expect(reportTimestamp(new Date(2026, 10, 9, 8, 5))).toMatch(/^2026-11-09 08:05 \(UTC[+-]\d\d:\d\d\)$/)
  })
})
