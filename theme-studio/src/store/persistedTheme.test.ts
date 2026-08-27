import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearPersistedTheme, hasMeaningfulContent, loadPersistedTheme, savePersistedTheme, type PersistedTheme } from './persistedTheme'

const SAMPLE: PersistedTheme = {
  version: 1,
  mode: 'dark',
  themeName: 'My Theme',
  assignments: { dark: [['keyword', '#ff0000']], light: [] },
  chrome: { dark: { background: '#000000' }, light: {} },
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('loadPersistedTheme / savePersistedTheme', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadPersistedTheme()).toBeNull()
  })

  it('round-trips a saved state', () => {
    savePersistedTheme(SAMPLE)
    expect(loadPersistedTheme()).toEqual(SAMPLE)
  })

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('theme-studio:autosave:v1', '{ not json')
    expect(loadPersistedTheme()).toBeNull()
  })

  it('returns null for a missing/wrong version', () => {
    localStorage.setItem('theme-studio:autosave:v1', JSON.stringify({ ...SAMPLE, version: 2 }))
    expect(loadPersistedTheme()).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    localStorage.setItem('theme-studio:autosave:v1', JSON.stringify({ version: 1, mode: 'dark' }))
    expect(loadPersistedTheme()).toBeNull()
  })

  it('restores a session saved within the last hour', () => {
    localStorage.setItem(
      'theme-studio:autosave:v1',
      JSON.stringify({ savedAt: Date.now() - 59 * 60 * 1000, state: SAMPLE }),
    )
    expect(loadPersistedTheme()).toEqual(SAMPLE)
  })

  it('returns null and clears storage for a session older than the 1 hour TTL', () => {
    localStorage.setItem(
      'theme-studio:autosave:v1',
      JSON.stringify({ savedAt: Date.now() - 61 * 60 * 1000, state: SAMPLE }),
    )
    expect(loadPersistedTheme()).toBeNull()
    expect(localStorage.getItem('theme-studio:autosave:v1')).toBeNull()
  })

  it('returns null for a legacy (pre-TTL) unwrapped record', () => {
    localStorage.setItem('theme-studio:autosave:v1', JSON.stringify(SAMPLE))
    expect(loadPersistedTheme()).toBeNull()
  })
})

describe('clearPersistedTheme', () => {
  it('removes a saved state', () => {
    savePersistedTheme(SAMPLE)
    clearPersistedTheme()
    expect(loadPersistedTheme()).toBeNull()
  })
})

describe('hasMeaningfulContent', () => {
  it('is false for an empty session', () => {
    expect(hasMeaningfulContent({ version: 1, mode: 'light', themeName: 'My Theme', assignments: {}, chrome: {} })).toBe(false)
  })

  it('is true when a mode has assignments', () => {
    expect(hasMeaningfulContent(SAMPLE)).toBe(true)
  })

  it('is true when a mode has a chrome override but no assignments', () => {
    expect(
      hasMeaningfulContent({
        version: 1,
        mode: 'dark',
        themeName: 'My Theme',
        assignments: {},
        chrome: { dark: { foreground: '#ffffff' } },
      }),
    ).toBe(true)
  })
})
