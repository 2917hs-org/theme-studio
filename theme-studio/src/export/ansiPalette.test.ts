import { describe, expect, it } from 'vitest'
import { hexToHsv } from '../theme/colorParse'
import { deriveAnsiPalette } from './ansiPalette'

// Tokyo Night's real accents — a good "well-populated theme" fixture.
const DARK_BG = '#1a1b26'
const DARK_FG = '#a9b1d6'
const TOKYO_NIGHT_ACCENTS = ['#bb9af7', '#9ece6a', '#7aa2f7', '#ff9e64', '#0db9d7', '#f7768e']

describe('deriveAnsiPalette', () => {
  it('anchors black to the darker of background/foreground and white to the lighter, for a dark theme', () => {
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    expect(palette.black).toBe(DARK_BG)
    expect(palette.white).toBe(DARK_FG)
  })

  it('anchors black to the darker of background/foreground and white to the lighter, for a light theme', () => {
    const palette = deriveAnsiPalette('#ffffff', '#1f2328', TOKYO_NIGHT_ACCENTS)
    expect(palette.black).toBe('#1f2328')
    expect(palette.white).toBe('#ffffff')
  })

  it('hue-matches a real accent color onto its nearest named slot', () => {
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    // #9ece6a is a clear green; #f7768e is a clear red/pink.
    expect(hexToHsv(palette.green).h).toBeGreaterThan(60)
    expect(hexToHsv(palette.green).h).toBeLessThan(180)
    const redHue = hexToHsv(palette.red).h
    expect(redHue < 40 || redHue > 320).toBe(true)
  })

  it('produces a usable fallback for a hue with no close accent, instead of leaving it undefined', () => {
    // Only a green accent — every other slot has to fall back.
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, ['#9ece6a'])
    expect(palette.magenta).toBeTruthy()
    expect(palette.blue).toBeTruthy()
    // The fallback should still land near the magenta hue (300°), not just any color.
    const hue = hexToHsv(palette.magenta).h
    expect(Math.min(Math.abs(hue - 300), 360 - Math.abs(hue - 300))).toBeLessThan(15)
  })

  it('ignores near-gray accents rather than letting them "win" a hue slot by coincidence', () => {
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, ['#888888'])
    // #888888 has ~0 saturation, so every slot should fall back rather than adopt gray.
    expect(hexToHsv(palette.red).s).toBeGreaterThan(0.1)
  })

  it('makes bright variants strictly higher in value than their base slot', () => {
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    expect(hexToHsv(palette.brightRed).v).toBeGreaterThanOrEqual(hexToHsv(palette.red).v)
    expect(hexToHsv(palette.brightGreen).v).toBeGreaterThanOrEqual(hexToHsv(palette.green).v)
  })

  it('is deterministic for the same input', () => {
    const a = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    const b = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    expect(a).toEqual(b)
  })

  it('returns valid 6-digit hex for every slot', () => {
    const palette = deriveAnsiPalette(DARK_BG, DARK_FG, TOKYO_NIGHT_ACCENTS)
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
