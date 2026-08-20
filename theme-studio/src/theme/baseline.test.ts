import { describe, expect, it } from 'vitest'
import { baselineColorsFor, defaultBackgroundFor, defaultForegroundFor, isolatedForegroundFor } from './baseline'

describe('baselineColorsFor', () => {
  it('returns dark baseline colors unmodified with no override', () => {
    const colors = baselineColorsFor('dark')
    expect(colors['editor.background']).toBe('#1e1e1e')
    expect(colors['editor.foreground']).toBe('#d4d4d4')
  })

  it('returns light baseline colors unmodified with no override', () => {
    const colors = baselineColorsFor('light')
    expect(colors['editor.background']).toBe('#ffffff')
  })

  it('applies a background override without touching foreground', () => {
    const colors = baselineColorsFor('dark', { background: '#123456' })
    expect(colors['editor.background']).toBe('#123456')
    expect(colors['editor.foreground']).toBe('#d4d4d4')
  })

  it('applies both overrides together', () => {
    const colors = baselineColorsFor('light', { background: '#111111', foreground: '#eeeeee' })
    expect(colors['editor.background']).toBe('#111111')
    expect(colors['editor.foreground']).toBe('#eeeeee')
  })

  it('does not mutate the shared baseline table across calls', () => {
    baselineColorsFor('dark', { background: '#ff0000' })
    const fresh = baselineColorsFor('dark')
    expect(fresh['editor.background']).toBe('#1e1e1e')
  })
})

describe('defaultForegroundFor', () => {
  it('falls back to mode default with no override', () => {
    expect(defaultForegroundFor('dark')).toBe('#d4d4d4')
    expect(defaultForegroundFor('light')).toBe('#000000')
  })

  it('prefers the override foreground when present', () => {
    expect(defaultForegroundFor('dark', { foreground: '#abcdef' })).toBe('#abcdef')
  })
})

describe('defaultBackgroundFor', () => {
  it('falls back to mode default with no override', () => {
    expect(defaultBackgroundFor('dark')).toBe('#1e1e1e')
    expect(defaultBackgroundFor('light')).toBe('#ffffff')
  })

  it('prefers the override background when present', () => {
    expect(defaultBackgroundFor('dark', { background: '#123456' })).toBe('#123456')
  })
})

describe('isolatedForegroundFor', () => {
  it('differs between modes', () => {
    expect(isolatedForegroundFor('dark')).not.toBe(isolatedForegroundFor('light'))
  })
})
