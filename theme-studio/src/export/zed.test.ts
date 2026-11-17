import { describe, expect, it } from 'vitest'
import { deriveAnsiPalette } from './ansiPalette'
import { accentColorsByField, extractBaseRoles } from './baseRoles'
import { buildZedTheme, zedThemeJson } from './zed'

const ASSIGNMENTS = new Map([
  ['keyword', '#bb9af7'],
  ['string', '#9ece6a'],
  ['entity.name.function', '#7aa2f7'],
  ['constant.character.escape', '#89ddff'],
  ['comment', '#565f89'],
])
const BASE = extractBaseRoles('dark', ASSIGNMENTS, {})
const ANSI = deriveAnsiPalette(BASE.background, BASE.foreground, BASE.accents)
const ACCENTS_BY_FIELD = accentColorsByField(ASSIGNMENTS)

describe('buildZedTheme', () => {
  it('uses the real, verified Zed schema URL and required top-level fields', () => {
    const theme = buildZedTheme('My Theme', 'dark', BASE, ANSI, ACCENTS_BY_FIELD)
    expect(theme.$schema).toBe('https://zed.dev/schema/themes/v0.2.0.json')
    expect(theme.name).toBe('My Theme')
    expect(theme.author).toBeTruthy()
    expect(theme.themes).toHaveLength(1)
  })

  it('carries the mode through as "appearance"', () => {
    expect(buildZedTheme('T', 'dark', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].appearance).toBe('dark')
    expect(buildZedTheme('T', 'light', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].appearance).toBe('light')
  })

  it('appends the alpha byte Zed expects on every color', () => {
    const style = buildZedTheme('T', 'dark', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].style;
    expect(style.background).toMatch(/^#[0-9a-f]{8}$/)
    expect(style['terminal.ansi.red']).toMatch(/^#[0-9a-f]{8}$/)
  })

  it('maps every real terminal.ansi.* key Zed documents', () => {
    const style = buildZedTheme('T', 'dark', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].style
    for (const name of ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']) {
      expect(style).toHaveProperty(`terminal.ansi.${name}`)
      expect(style).toHaveProperty(`terminal.ansi.bright_${name === 'white' || name === 'black' ? name : name}`)
    }
  })

  it('prefers a more specific field over a general one for a syntax key (string.escape over string)', () => {
    const style = buildZedTheme('T', 'dark', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].style
    expect(style.syntax['string.escape'].color).toBe(`${ACCENTS_BY_FIELD.stringEscape}ff`)
    expect(style.syntax['string.escape'].color).not.toBe(style.syntax.string.color)
  })

  it('omits a syntax key entirely when no candidate field was ever colored', () => {
    const bare = accentColorsByField(new Map([['keyword', '#111111']]))
    const style = buildZedTheme('T', 'dark', BASE, ANSI, bare).themes[0].style
    expect(style.syntax.keyword).toBeDefined()
    expect(style.syntax.string).toBeUndefined()
  })

  it('marks comments as italic and other syntax keys as not', () => {
    const style = buildZedTheme('T', 'dark', BASE, ANSI, ACCENTS_BY_FIELD).themes[0].style
    expect(style.syntax.comment.font_style).toBe('italic')
    expect(style.syntax.keyword.font_style).toBeNull()
  })
})

describe('zedThemeJson', () => {
  it('produces valid JSON that round-trips back to the same shape', () => {
    const json = zedThemeJson('My Theme', 'dark', BASE, ANSI, ACCENTS_BY_FIELD)
    const parsed = JSON.parse(json)
    expect(parsed.name).toBe('My Theme')
    expect(parsed.themes[0].style.syntax.keyword.color).toBe(`${ACCENTS_BY_FIELD.keywords}ff`)
  })
})
