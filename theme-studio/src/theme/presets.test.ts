import { describe, expect, it } from 'vitest'
import { PRESET_SCOPES, THEME_PRESETS } from './presets'

const HEX_RE = /^#[0-9a-f]{6}$/i

describe('THEME_PRESETS data integrity', () => {
  it('has unique ids', () => {
    const ids = THEME_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every color field is a valid 6-digit hex string', () => {
    for (const preset of THEME_PRESETS) {
      for (const key of ['background', 'text', 'comments', 'keywords', 'strings', 'functions'] as const) {
        expect(preset[key], `${preset.id}.${key}`).toMatch(HEX_RE)
      }
      if (preset.numbers !== undefined) {
        expect(preset.numbers, `${preset.id}.numbers`).toMatch(HEX_RE)
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
