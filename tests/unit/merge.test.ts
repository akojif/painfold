import { describe, expect, it } from 'vitest'
import { combined, outside } from '../../core/detect/merge'
import type { Detection } from '../../core/detect/types'

const at = (text: string, type: Detection['type'], value: string): Detection => {
  const start = text.indexOf(value)
  return { type, start, end: start + value.length, value }
}

describe('merging the name model\'s findings with existing ones', () => {
  const text = 'Billing address changed to 28 Harbour Street, Bristol BS1 4DJ but old invoices still show it.'
  const rules = [at(text, 'ADDRESS', '28 Harbour Street'), at(text, 'POSTCODE', 'BS1 4DJ')]

  it('cuts off what a rule finding already covers and keeps the rest', () => {
    expect(outside(text, at(text, 'PLACE', 'Bristol BS'), rules).map(found => found.value)).toEqual(['Bristol'])
  })

  it('drops a finding the rules cover completely', () => {
    expect(outside(text, at(text, 'PLACE', 'Harbour Street'), rules)).toEqual([])
  })

  it('keeps findings that do not touch any rule finding as they are', () => {
    expect(outside(text, at(text, 'PLACE', 'Bristol'), rules)).toEqual([at(text, 'PLACE', 'Bristol')])
  })

  it('combines the rules and what is left of the names', () => {
    expect(combined(text, rules, [at(text, 'PLACE', 'Harbour Street'), at(text, 'PLACE', 'Bristol BS')]).map(found => `${found.type}:${found.value}`))
      .toEqual(['ADDRESS:28 Harbour Street', 'POSTCODE:BS1 4DJ', 'PLACE:Bristol'])
  })

  it('splits a finding around a rule finding inside it, keeping only parts with letters', () => {
    const mail = 'Anna (anna@example.com) Huber'
    expect(outside(mail, { type: 'NAME', start: 0, end: mail.length, value: mail }, [at(mail, 'EMAIL', 'anna@example.com')]).map(found => found.value)).toEqual(['Anna', 'Huber'])
  })
})
