import { describe, expect, it } from 'vitest'
import { buildMonacoTheme, buildVSCodeTheme } from './themeBuilder'

describe('buildVSCodeTheme', () => {
  it('produces a Default token rule plus one rule per assignment', () => {
    const assignments = new Map([
      ['keyword', '#ff0000'],
      ['string', '#00ff00'],
    ])
    const theme = buildVSCodeTheme('My Theme', 'dark', assignments)
    expect(theme.name).toBe('My Theme')
    expect(theme.type).toBe('dark')
    expect(theme.tokenColors[0]).toEqual({
      name: 'Default',
      scope: ['source'],
      settings: { foreground: '#d4d4d4' },
    })
    expect(theme.tokenColors).toHaveLength(3)
    expect(theme.tokenColors[1]).toEqual({ name: 'keyword', scope: 'keyword', settings: { foreground: '#ff0000' } })
  })

  it('produces only the Default rule when there are no assignments', () => {
    const theme = buildVSCodeTheme('Empty', 'light', new Map())
    expect(theme.tokenColors).toHaveLength(1)
  })

  it('threads a chrome override into both colors and the Default foreground', () => {
    const theme = buildVSCodeTheme('Custom', 'dark', new Map(), { background: '#000000', foreground: '#ffffff' })
    expect(theme.colors['editor.background']).toBe('#000000')
    expect(theme.tokenColors[0].settings.foreground).toBe('#ffffff')
  })
})

describe('buildMonacoTheme', () => {
  it('inherits Monaco defaults when not isolating', () => {
    const theme = buildMonacoTheme('dark', new Map())
    expect(theme.inherit).toBe(true)
    expect(theme.rules).toEqual([])
  })

  it('disables inherit and adds a catch-all gray rule when isolating', () => {
    const theme = buildMonacoTheme('dark', new Map(), { isolate: true })
    expect(theme.inherit).toBe(false)
    expect(theme.rules[0]).toEqual({ token: '', foreground: '6a6a6a' })
  })

  it('strips the leading # from assignment colors for Monaco rules', () => {
    const theme = buildMonacoTheme('light', new Map([['comment', '#abcdef']]))
    expect(theme.rules).toContainEqual({ token: 'comment', foreground: 'abcdef' })
  })

  it('maps mode to the correct Monaco base theme', () => {
    expect(buildMonacoTheme('dark', new Map()).base).toBe('vs-dark')
    expect(buildMonacoTheme('light', new Map()).base).toBe('vs')
  })
})
