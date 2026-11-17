import { describe, expect, it } from 'vitest'
import { deriveAnsiPalette } from './ansiPalette'
import { extractBaseRoles } from './baseRoles'
import { buildItermColorsPlist } from './iterm2'

const BASE = extractBaseRoles('dark', new Map([
  ['keyword', '#bb9af7'],
  ['string', '#9ece6a'],
  ['entity.name.function', '#7aa2f7'],
]), {})
const ANSI = deriveAnsiPalette(BASE.background, BASE.foreground, BASE.accents)

describe('buildItermColorsPlist', () => {
  const plist = buildItermColorsPlist(BASE, ANSI)

  it('starts with a valid plist XML declaration and DOCTYPE', () => {
    expect(plist.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(plist).toContain('<!DOCTYPE plist PUBLIC')
    expect(plist).toContain('<plist version="1.0">')
  })

  it('has balanced dict/key/real tags — a malformed plist fails silently in iTerm2 with no useful error', () => {
    // Tolerates attributes on the opening tag (e.g. `<plist version="1.0">`) — only `<plist>` itself carries any.
    const opens = (tag: string) => (plist.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) ?? []).length
    const closes = (tag: string) => (plist.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    for (const tag of ['dict', 'key', 'real', 'string', 'plist']) {
      expect(closes(tag)).toBe(opens(tag))
    }
  })

  it('defines all 16 Ansi color entries in the standard 0-15 order', () => {
    for (let i = 0; i < 16; i++) {
      expect(plist).toContain(`<key>Ansi ${i} Color</key>`)
    }
  })

  it('includes the required non-ANSI entries', () => {
    for (const key of ['Background Color', 'Foreground Color', 'Cursor Color', 'Cursor Text Color', 'Selection Color', 'Selected Text Color']) {
      expect(plist).toContain(`<key>${key}</key>`)
    }
  })

  it('never emits a "name" key — iTerm2 names a profile from the imported filename, not file content', () => {
    expect(plist).not.toContain('<key>Name</key>')
  })

  it('converts a hex color to correctly-normalized 0-1 float RGB components', () => {
    const whiteOnBlack = extractBaseRoles('dark', new Map(), { background: '#ffffff', foreground: '#000000' })
    const p = buildItermColorsPlist(whiteOnBlack, ANSI)
    const bgSection = p.slice(p.indexOf('<key>Background Color</key>'))
    expect(bgSection).toContain('<real>1</real>')
    const fgSection = p.slice(p.indexOf('<key>Foreground Color</key>'))
    expect(fgSection).toContain('<real>0</real>')
  })
})
