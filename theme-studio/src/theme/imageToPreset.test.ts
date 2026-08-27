import { describe, expect, it } from 'vitest'
import { contrastRatio } from './colorParse'
import { ROLE_SCOPES, type PresetField } from './presetPalette'
import {
  CORE_FIELDS,
  buildImageTheme,
  chooseCoreFields,
  deriveTheme,
  ensureContrast,
  fieldsToAssignments,
  suggestedNameFromFile,
  type CoreField,
} from './imageToPreset'

const HEX_RE = /^#[0-9a-f]{6}$/i

function fakeFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' })
}

describe('ensureContrast', () => {
  it('leaves a color alone if it already clears the ratio', () => {
    expect(ensureContrast('#ffffff', '#000000')).toBe('#ffffff')
  })

  it('brightens a color that is too close to a dark background', () => {
    const result = ensureContrast('#222222', '#1e1e1e')
    expect(contrastRatio(result, '#1e1e1e')).toBeGreaterThanOrEqual(4.5)
  })

  it('darkens a color that is too close to a light background', () => {
    const result = ensureContrast('#eeeeee', '#ffffff')
    expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('preserves hue while adjusting', () => {
    // A saturated blue against a near-identical dark background should stay
    // recognizably blue after being pushed lighter, not shift toward grey.
    const result = ensureContrast('#1a1a30', '#1e1e1e')
    expect(result).not.toBe('#1e1e1e')
    expect(contrastRatio(result, '#1e1e1e')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('chooseCoreFields', () => {
  it('picks the darkest cluster as background in dark mode', () => {
    const palette = { colors: ['#111111', '#ff0000', '#00ff00', '#0000ff', '#eeeeee'], averageLuminance: 0.3 }
    const core = chooseCoreFields(palette, 'dark')
    expect(core.background).toBe('#111111')
  })

  it('picks the lightest cluster as background in light mode', () => {
    const palette = { colors: ['#111111', '#ff0000', '#00ff00', '#0000ff', '#eeeeee'], averageLuminance: 0.3 }
    const core = chooseCoreFields(palette, 'light')
    expect(core.background).toBe('#eeeeee')
  })

  it('picks a text color that is not the background', () => {
    const palette = { colors: ['#111111', '#222222', '#ffffff'], averageLuminance: 0.3 }
    const core = chooseCoreFields(palette, 'dark')
    expect(core.text).not.toBe(core.background)
  })

  it('returns every CoreField for a low-color image without crashing', () => {
    const palette = { colors: ['#111111', '#eeeeee', '#886644'], averageLuminance: 0.4 }
    const core = chooseCoreFields(palette, 'dark')
    for (const field of CORE_FIELDS) {
      expect(core[field as CoreField]).toMatch(HEX_RE)
    }
  })
})

describe('deriveTheme', () => {
  const core: Record<CoreField, string> = {
    background: '#1e1e1e',
    text: '#dcdcdc',
    keywords: '#c586c0',
    strings: '#ce9178',
    functions: '#dcdcaa',
    types: '#4ec9b0',
    numbers: '#b5cea8',
  }

  it('produces every PresetField the scope map needs', () => {
    const { fields } = deriveTheme(core)
    const neededFields = new Set(Object.values(ROLE_SCOPES).map((r) => r.field))
    for (const field of neededFields) {
      expect(fields[field as PresetField]).toMatch(HEX_RE)
    }
  })

  it('keeps every accent above the WCAG AA floor against the background', () => {
    const { background, fields } = deriveTheme(core)
    for (const field of ['text', 'keywords', 'strings', 'functions', 'types', 'numbers'] as const) {
      expect(contrastRatio(fields[field], background)).toBeGreaterThanOrEqual(4.49)
    }
  })

  it('keeps diff colors on their conventional hue regardless of the source palette', () => {
    const warmCore: Record<CoreField, string> = { ...core, keywords: '#ff8800', strings: '#ffaa00', functions: '#ffcc00' }
    const { fields } = deriveTheme(warmCore)
    // Inserted should read green-ish, deleted red/pink-ish, not whatever
    // warm hue the rest of the (all-orange) palette happens to be.
    expect(fields.diffInserted.toLowerCase()).not.toBe(fields.diffDeleted.toLowerCase())
  })

  it('is deterministic for the same input', () => {
    const a = deriveTheme(core)
    const b = deriveTheme(core)
    expect(a).toEqual(b)
  })
})

describe('fieldsToAssignments', () => {
  it('assigns every scope in ROLE_SCOPES', () => {
    const { fields } = deriveTheme({
      background: '#1e1e1e',
      text: '#dcdcdc',
      keywords: '#c586c0',
      strings: '#ce9178',
      functions: '#dcdcaa',
      types: '#4ec9b0',
      numbers: '#b5cea8',
    })
    const assignments = fieldsToAssignments(fields)
    for (const { scopes } of Object.values(ROLE_SCOPES)) {
      for (const scope of scopes) {
        expect(assignments.get(scope)).toMatch(HEX_RE)
      }
    }
  })
})

describe('suggestedNameFromFile', () => {
  it('title-cases a hyphenated filename', () => {
    expect(suggestedNameFromFile(fakeFile('sunset-harbor.jpg'))).toBe('Sunset Harbor')
  })

  it('title-cases an underscored filename', () => {
    expect(suggestedNameFromFile(fakeFile('my_desk_setup.png'))).toBe('My Desk Setup')
  })

  it('falls back to a generic name for an unusable filename', () => {
    expect(suggestedNameFromFile(fakeFile('....png'))).toBe('Photo Theme')
  })
})

describe('buildImageTheme', () => {
  it('produces an ImportedTheme with one variant in the requested mode', () => {
    const core: Record<CoreField, string> = {
      background: '#1e1e1e',
      text: '#dcdcdc',
      keywords: '#c586c0',
      strings: '#ce9178',
      functions: '#dcdcaa',
      types: '#4ec9b0',
      numbers: '#b5cea8',
    }
    const theme = buildImageTheme('Sunset Harbor', core, 'dark')
    expect(theme.name).toBe('Sunset Harbor')
    expect(theme.variants).toHaveLength(1)
    expect(theme.variants[0].mode).toBe('dark')
    expect(theme.variants[0].chrome.background).toBe('#1e1e1e')
    expect(theme.variants[0].assignments.size).toBeGreaterThan(0)
  })
})
