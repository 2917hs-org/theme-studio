import { describe, expect, it } from 'vitest'
import { accentColorsByField, extractBaseRoles, MIN_POPULATED_ACCENTS_FOR_EXTERNAL_EXPORT } from './baseRoles'

describe('extractBaseRoles', () => {
  it('falls back to the mode baseline when nothing is colored and no chrome override is set', () => {
    const roles = extractBaseRoles('dark', new Map(), {})
    expect(roles.background).toBe('#1e1e1e')
    expect(roles.foreground).toBe('#d4d4d4')
    expect(roles.accents).toEqual([])
    expect(roles.populatedAccentCount).toBe(0)
  })

  it('uses a chrome override for background/foreground when present', () => {
    const roles = extractBaseRoles('dark', new Map(), { background: '#101010', foreground: '#eeeeee' })
    expect(roles.background).toBe('#101010')
    expect(roles.foreground).toBe('#eeeeee')
  })

  it('resolves an accent field from any real scope under it, not just one hardcoded representative', () => {
    // 'keyword.control.conditional' is a real scope under the `keywords`
    // field in ROLE_SCOPES, not the umbrella `keyword` scope itself — a
    // hand-colored theme that only ever painted this specific one should
    // still resolve.
    const assignments = new Map([
      ['keyword.control.conditional', '#ff00ff'],
      ['entity.name.function', '#00ffff'],
    ])
    const roles = extractBaseRoles('dark', assignments, {})
    expect(roles.accents).toContain('#ff00ff')
    expect(roles.accents).toContain('#00ffff')
    expect(roles.populatedAccentCount).toBe(2)
  })

  it('reports enough accents to clear the export threshold once enough fields are colored', () => {
    const assignments = new Map([
      ['keyword', '#111111'],
      ['string', '#222222'],
      ['entity.name.function', '#333333'],
    ])
    const roles = extractBaseRoles('dark', assignments, {})
    expect(roles.populatedAccentCount).toBeGreaterThanOrEqual(MIN_POPULATED_ACCENTS_FOR_EXTERNAL_EXPORT)
  })
})

describe('accentColorsByField', () => {
  it('maps only the fields that actually have an assigned color', () => {
    const assignments = new Map([['keyword', '#111111']])
    const result = accentColorsByField(assignments)
    expect(result.keywords).toBe('#111111')
    expect(result.strings).toBeUndefined()
  })

  it('returns an empty object for no assignments', () => {
    expect(accentColorsByField(new Map())).toEqual({})
  })
})
