import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToHsv,
  hexToRgb,
  hslToRgb,
  hsvToHex,
  hsvToRgb,
  parseColorToHex,
  rgbToHex,
  rgbToHsv,
} from './colorParse'

describe('parseColorToHex', () => {
  it('normalizes 6-digit hex with a leading #', () => {
    expect(parseColorToHex('#1E1E1E')).toBe('#1e1e1e')
  })

  it('normalizes 6-digit hex without a leading #', () => {
    expect(parseColorToHex('1e1e1e')).toBe('#1e1e1e')
  })

  it('expands 3-digit hex shorthand', () => {
    expect(parseColorToHex('#abc')).toBe('#aabbcc')
  })

  it('parses rgb()', () => {
    expect(parseColorToHex('rgb(30, 30, 30)')).toBe('#1e1e1e')
  })

  it('parses rgba() ignoring alpha', () => {
    expect(parseColorToHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000')
  })

  it('parses hsl()', () => {
    expect(parseColorToHex('hsl(0, 100%, 50%)')).toBe('#ff0000')
  })

  it('parses hsla() ignoring alpha', () => {
    expect(parseColorToHex('hsla(120, 100%, 50%, 0.3)')).toBe('#00ff00')
  })

  it('returns null for garbage input', () => {
    expect(parseColorToHex('not-a-color')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseColorToHex('')).toBeNull()
  })

  it('trims whitespace before matching', () => {
    expect(parseColorToHex('  #fff  ')).toBe('#ffffff')
  })
})

describe('rgbToHex', () => {
  it('converts and pads component values', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
    expect(rgbToHex(1, 2, 3)).toBe('#010203')
  })

  it('clamps out-of-range values instead of producing invalid hex', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80')
  })

  it('rounds fractional components', () => {
    expect(rgbToHex(127.6, 0, 0)).toBe('#800000')
  })
})

describe('hexToRgb', () => {
  it('round-trips with rgbToHex', () => {
    expect(hexToRgb('#1e90ff')).toEqual([30, 144, 255])
  })

  it('accepts hex without a leading #', () => {
    expect(hexToRgb('ffffff')).toEqual([255, 255, 255])
  })
})

describe('rgbToHsv / hsvToRgb round trip', () => {
  it('round-trips pure red', () => {
    const hsv = rgbToHsv(255, 0, 0)
    expect(hsv.h).toBeCloseTo(0)
    expect(hsv.s).toBeCloseTo(1)
    expect(hsv.v).toBeCloseTo(1)
    const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v)
    expect(Math.round(r)).toBe(255)
    expect(Math.round(g)).toBe(0)
    expect(Math.round(b)).toBe(0)
  })

  it('treats black as zero saturation with zero hue', () => {
    const hsv = rgbToHsv(0, 0, 0)
    expect(hsv.s).toBe(0)
    expect(hsv.v).toBe(0)
  })

  it('round-trips an arbitrary color via hex helpers', () => {
    const hex = '#3388cc'
    const hsv = hexToHsv(hex)
    expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(hex)
  })
})

describe('hslToRgb', () => {
  it('converts pure green', () => {
    const [r, g, b] = hslToRgb(120, 1, 0.5)
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([0, 255, 0])
  })

  it('converts grayscale (zero saturation) regardless of hue', () => {
    const [r, g, b] = hslToRgb(200, 0, 0.5)
    expect(Math.round(r)).toBe(Math.round(g))
    expect(Math.round(g)).toBe(Math.round(b))
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('is 1:1 for identical colors', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#123456', '#abcdef')
    const b = contrastRatio('#abcdef', '#123456')
    expect(a).toBeCloseTo(b, 10)
  })
})
