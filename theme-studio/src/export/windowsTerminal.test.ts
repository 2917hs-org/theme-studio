import { describe, expect, it } from 'vitest'
import { deriveAnsiPalette } from './ansiPalette'
import { extractBaseRoles } from './baseRoles'
import { buildWindowsTerminalScheme, windowsTerminalJson } from './windowsTerminal'

const ASSIGNMENTS = new Map([
  ['keyword', '#bb9af7'],
  ['string', '#9ece6a'],
  ['entity.name.function', '#7aa2f7'],
])
const BASE = extractBaseRoles('dark', ASSIGNMENTS, {})
const ANSI = deriveAnsiPalette(BASE.background, BASE.foreground, BASE.accents)

describe('buildWindowsTerminalScheme', () => {
  it('carries the theme name and background/foreground through unchanged', () => {
    const scheme = buildWindowsTerminalScheme('My Theme', BASE, ANSI)
    expect(scheme.name).toBe('My Theme')
    expect(scheme.background).toBe(BASE.background)
    expect(scheme.foreground).toBe(BASE.foreground)
  })

  it('maps the ANSI magenta slot onto Windows Terminal\'s "purple" field, not "magenta"', () => {
    const scheme = buildWindowsTerminalScheme('My Theme', BASE, ANSI)
    expect(scheme.purple).toBe(ANSI.magenta)
    expect(scheme.brightPurple).toBe(ANSI.brightMagenta)
    expect(scheme).not.toHaveProperty('magenta')
  })

  it('includes every field Windows Terminal expects', () => {
    const scheme = buildWindowsTerminalScheme('My Theme', BASE, ANSI)
    for (const key of [
      'name', 'background', 'foreground', 'cursorColor', 'selectionBackground',
      'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightPurple', 'brightCyan', 'brightWhite',
    ]) {
      expect(scheme).toHaveProperty(key)
    }
  })
})

describe('windowsTerminalJson', () => {
  it('produces valid, pretty-printed JSON', () => {
    const json = windowsTerminalJson('My Theme', BASE, ANSI)
    expect(() => JSON.parse(json)).not.toThrow()
    expect(json).toContain('\n')
  })
})
