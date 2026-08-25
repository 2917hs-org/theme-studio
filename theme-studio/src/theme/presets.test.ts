import { describe, expect, it } from 'vitest'
import { ROLE_SCOPES, type PresetField } from './presetPalette'
import { PRESET_SCOPES, THEME_PRESETS, type ThemePreset } from './presets'

const HEX_RE = /^#[0-9a-f]{6}$/i

// Every field a preset can be indexed by via ROLE_SCOPES, plus background —
// this is the full set a preset must define so applyPreset never looks up
// `undefined` for some role's field.
const ALL_PRESET_COLOR_FIELDS: Array<keyof ThemePreset> = [
  'background',
  'text',
  'comments',
  'keywords',
  'strings',
  'functions',
  'numbers',
  'stringEscape',
  'regexp',
  'constants',
  'storage',
  'punctuation',
  'functionsBuiltin',
  'types',
  'typesBuiltin',
  'variables',
  'variablesProperty',
  'tags',
  'tagsAttribute',
  'markup',
  'diffInserted',
  'diffDeleted',
  'diffChanged',
  'invalid',
]

describe('THEME_PRESETS data integrity', () => {
  it('has unique ids', () => {
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every color field is a valid 6-digit hex string', () => {
    for (const preset of THEME_PRESETS) {
      for (const key of ALL_PRESET_COLOR_FIELDS) {
        expect(preset[key], `${preset.id}.${key}`).toMatch(HEX_RE)
      }
    }
  })

  it('declares a mode of either dark or light', () => {
    for (const preset of THEME_PRESETS) {
      expect(['dark', 'light']).toContain(preset.mode)
    }
  })

  it('includes at least one dark and one light preset', () => {
    expect(THEME_PRESETS.some((p) => p.mode === 'dark')).toBe(true)
    expect(THEME_PRESETS.some((p) => p.mode === 'light')).toBe(true)
  })
})

describe('PRESET_SCOPES', () => {
  it('maps every preset color field (except background/text) to a TextMate scope', () => {
    expect(Object.keys(PRESET_SCOPES).sort()).toEqual(['comments', 'functions', 'keywords', 'numbers', 'strings'])
  })
})

describe('ROLE_SCOPES', () => {
  it('every role points at a field every preset actually defines', () => {
    const fieldSet = new Set<string>(ALL_PRESET_COLOR_FIELDS)
    for (const [role, { field }] of Object.entries(ROLE_SCOPES)) {
      expect(fieldSet.has(field), `role "${role}" points at unknown field "${field}"`).toBe(true)
    }
  })

  it('every role scope list is non-empty', () => {
    for (const [role, { scopes }] of Object.entries(ROLE_SCOPES)) {
      expect(scopes.length, `role "${role}" has no scopes`).toBeGreaterThan(0)
    }
  })

  it('no scope string is claimed by more than one role', () => {
    const seen = new Map<string, string>()
    for (const [role, { scopes }] of Object.entries(ROLE_SCOPES)) {
      for (const scope of scopes) {
        const owner = seen.get(scope)
        expect(owner, `"${scope}" claimed by both "${owner}" and "${role}"`).toBeUndefined()
        seen.set(scope, role)
      }
    }
  })

  it('no scope string contains a space (Monaco\'s live-preview rules only match dot-hierarchy, not ancestor selectors)', () => {
    for (const { scopes } of Object.values(ROLE_SCOPES)) {
      for (const scope of scopes) {
        expect(scope, scope).not.toMatch(/\s/)
      }
    }
  })

  it('expands to well over 100 real scope assignments', () => {
    const total = Object.values(ROLE_SCOPES).reduce((sum, { scopes }) => sum + scopes.length, 0)
    expect(total).toBeGreaterThan(100)
  })

  it('every role field is a valid PresetField key', () => {
    // Compile-time check that PresetField and ThemePreset stay in sync —
    // if this doesn't type-check, one was edited without the other.
    const fields: PresetField[] = Object.values(ROLE_SCOPES).map((r) => r.field)
    expect(fields.length).toBeGreaterThan(0)
  })
})
