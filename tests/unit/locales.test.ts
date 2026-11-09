import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'

describe('English locale', () => {
  it('has the app name and tagline', () => {
    expect(en.app.name).toBe('Painfold')
    expect(en.app.tagline).not.toBe('')
  })
})
