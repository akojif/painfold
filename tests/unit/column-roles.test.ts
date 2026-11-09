import { describe, expect, it } from 'vitest'
import { guessFeedbackColumn, headerWords, personalHeaderTerm, suggestRole, suggestRoles } from '../../core/columns/roles'

describe('headerWords', () => {
  it('splits camelCase, separators and E-Mail spellings into plain words', () => {
    expect(headerWords('customerEmail')).toEqual(['customer', 'email'])
    expect(headerWords('Customer E-Mail')).toEqual(['customer', 'email'])
    expect(headerWords('Straße / Hausnr.')).toEqual(['strasse', 'hausnr'])
  })
})

describe('personalHeaderTerm', () => {
  it.each([
    'name', 'Name', 'customer_name', 'customerName', 'Customer Name', 'first_name', 'FirstName', 'last name', 'surname',
    'full_name', 'username', 'email', 'E-Mail', 'e_mail', 'Email Address', 'customer_email', 'Kunden-E-Mail',
    'phone', 'Phone Number', 'mobile', 'Telefon', 'Telefonnummer', 'Handy', 'Tel.', 'fax',
    'address', 'Adresse', 'Straße', 'strasse', 'Anschrift', 'PLZ', 'Postleitzahl', 'zip', 'postcode', 'Ort', 'Wohnort', 'city',
    'Vorname', 'Nachname', 'Kunde', 'Kundenname', 'Kundennummer', 'Kunden-Nr', 'customer', 'customer_id', 'Customer No',
    'client', 'user', 'user_id', 'Benutzername', 'Ansprechpartner', 'contact',
    'Geburtsdatum', 'date_of_birth', 'dob', 'birthday', 'SV-Nummer', 'Sozialversicherungsnummer',
    'IBAN', 'ip_address', 'IP', 'agent', 'Bearbeiter', 'assignee', 'author',
  ])('%s looks personal', (header) => {
    expect(personalHeaderTerm(header)).toBeDefined()
  })

  it.each([
    'message', 'feedback', 'Kundenfeedback', 'comment', 'Kommentar', 'text', 'Nachricht',
    'product_name', 'productName', 'Produktname', 'file_name', 'filename', 'project name', 'company_name', 'plan name',
    'plan', 'channel', 'country', 'Land', 'rating', 'created_at', 'date', 'Datum', 'subject', 'Betreff',
    'customer_segment', 'Kundensegment', 'Kundengruppe', 'customer_since', 'contact_reason',
    'id', 'ticket_id', 'order_number', 'Bestellnummer', 'report', 'export', 'category', 'status', 'nps', 'score', 'version',
  ])('%s does not look personal', (header) => {
    expect(personalHeaderTerm(header)).toBeUndefined()
  })
})

describe('suggestRole', () => {
  it('drops columns with personal headers and names the word that matched', () => {
    expect(suggestRole('customer_email', ['a@example.com'])).toEqual({ role: 'drop', reason: 'personal-header', term: 'email' })
  })

  it('scans other columns that contain letters', () => {
    expect(suggestRole('message', ['The export is slow'])).toEqual({ role: 'scan', reason: 'text' })
    expect(suggestRole('plan', ['Team', 'Free'])).toEqual({ role: 'scan', reason: 'text' })
  })

  it('keeps columns with only numbers, dates and symbols', () => {
    expect(suggestRole('rating', ['4', '5', ''])).toEqual({ role: 'keep', reason: 'no-text' })
    expect(suggestRole('created_at', ['2026-01-04', '2026-02-11'])).toEqual({ role: 'keep', reason: 'no-text' })
  })
})

describe('suggestRoles and guessFeedbackColumn', () => {
  const table = {
    columns: ['id', 'created_at', 'channel', 'customer_name', 'customer_email', 'message'],
    rows: [
      ['1', '2026-01-04', 'Email', 'Anna Feldmoser', 'anna@example.com', 'Der PDF-Export dauert seit dem Update ewig.'],
      ['2', '2026-01-05', 'Chat', 'James Dunmore', 'james@example.org', 'Please add automatic payment reminders.'],
    ],
  }

  it('suggests a role for every column', () => {
    expect(suggestRoles(table).map(suggestion => suggestion.role)).toEqual(['keep', 'keep', 'scan', 'drop', 'drop', 'scan'])
  })

  it('picks the non-personal text column with the longest entries', () => {
    expect(guessFeedbackColumn(table)).toBe(5)
  })

  it('makes no guess when no column holds sentences', () => {
    expect(guessFeedbackColumn({ columns: ['plan'], rows: [['Team'], ['Free']] })).toBeUndefined()
  })
})
