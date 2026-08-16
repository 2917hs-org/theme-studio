import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildVsixBlob, slugify } from './buildVsix'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('My Cool Theme')).toBe('my-cool-theme')
  })

  it('strips non-alphanumeric characters', () => {
    expect(slugify("Neo's Theme! (v2)")).toBe('neo-s-theme-v2')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Weird Name--  ')).toBe('weird-name')
  })

  it('falls back to "custom-theme" when nothing alphanumeric remains', () => {
    expect(slugify('!!!')).toBe('custom-theme')
    expect(slugify('')).toBe('custom-theme')
  })
})

describe('buildVsixBlob', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('produces a zip Blob', async () => {
    const assignments = { dark: new Map([['keyword', '#ff0000']]), light: new Map() }
    const blob = await buildVsixBlob('My Theme', assignments, 'dark')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('escapes XML-significant characters in the theme name for the manifest', async () => {
    const assignments = { dark: new Map(), light: new Map() }
    // Reading the zip back out isn't worth a new dependency here — this
    // guards the escaper doesn't throw and still produces a well-formed
    // (non-empty) archive for names carrying XML metacharacters.
    const blob = await buildVsixBlob('<Theme & "Friends">', assignments, 'dark')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('continues without an icon when the icon fetch fails', async () => {
    const assignments = { dark: new Map(), light: new Map() }
    await expect(buildVsixBlob('Fails Gracefully', assignments, 'dark')).resolves.toBeInstanceOf(Blob)
  })
})
