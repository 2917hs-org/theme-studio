import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentsProvider, DEFAULT_THEME_NAME, useAssignments } from './AssignmentsContext'
import { loadPersistedTheme, savePersistedTheme } from './persistedTheme'

function setup() {
  return renderHook(() => useAssignments(), { wrapper: AssignmentsProvider })
}

describe('AssignmentsContext', () => {
  // Every test starts from a clean autosave slate — this context reads
  // localStorage on mount (see persistedTheme.ts), so a previous test's
  // state must never leak into the next one's initial render.
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty, in light mode, with the default theme name', () => {
    const { result } = setup()
    expect(result.current.mode).toBe('light')
    expect(result.current.assignments.size).toBe(0)
    expect(result.current.themeName).toBe(DEFAULT_THEME_NAME)
    expect(result.current.recentColors).toEqual([])
  })

  it('setColor writes into the active mode only', () => {
    const { result } = setup()
    act(() => result.current.setColor('keyword', '#ff0000'))
    expect(result.current.assignments.get('keyword')).toBe('#ff0000')
    expect(result.current.assignmentsFor('dark').has('keyword')).toBe(false)
  })

  it('setColor with an explicit mode targets that mode regardless of the active one', () => {
    const { result } = setup()
    act(() => result.current.setColor('keyword', '#00ff00', 'dark'))
    expect(result.current.assignmentsFor('dark').get('keyword')).toBe('#00ff00')
    expect(result.current.assignments.has('keyword')).toBe(false)
  })

  it('clearColor removes only the targeted scope', () => {
    const { result } = setup()
    act(() => {
      result.current.setColor('keyword', '#ff0000')
      result.current.setColor('string', '#00ff00')
    })
    act(() => result.current.clearColor('keyword'))
    expect(result.current.assignments.has('keyword')).toBe(false)
    expect(result.current.assignments.has('string')).toBe(true)
  })

  it('clearAllColors empties both modes but preserves the theme name', () => {
    const { result } = setup()
    act(() => {
      result.current.setColor('keyword', '#ff0000', 'dark')
      result.current.setColor('string', '#00ff00', 'light')
      result.current.setThemeName('Kept Name')
    })
    act(() => result.current.clearAllColors())
    expect(result.current.assignmentsFor('dark').size).toBe(0)
    expect(result.current.assignmentsFor('light').size).toBe(0)
    expect(result.current.themeName).toBe('Kept Name')
  })

  it('replaceAssignments drops scopes not present in the new map instead of merging', () => {
    const { result } = setup()
    act(() => {
      result.current.setColor('keyword', '#ff0000', 'dark')
      result.current.setColor('type', '#00ff00', 'dark')
      result.current.setColor('string', '#0000ff', 'light')
    })
    act(() => result.current.replaceAssignments('dark', new Map([['keyword', '#123456']])))
    expect(result.current.assignmentsFor('dark')).toEqual(new Map([['keyword', '#123456']]))
    expect(result.current.assignmentsFor('dark').has('type')).toBe(false)
    // The other mode is untouched.
    expect(result.current.assignmentsFor('light').get('string')).toBe('#0000ff')
  })

  it('tracks recent colors newest-first, deduping case-insensitively, capped at 12', () => {
    const { result } = setup()
    act(() => {
      result.current.setColor('a', '#111111')
      result.current.setColor('b', '#222222')
      result.current.setColor('c', '#111111')
    })
    expect(result.current.recentColors[0]).toBe('#111111')
    expect(result.current.recentColors.filter((c) => c.toLowerCase() === '#111111').length).toBe(1)

    act(() => {
      for (let i = 0; i < 12; i++) result.current.setColor(`s${i}`, `#${String(i).padStart(6, '0')}`)
    })
    expect(result.current.recentColors.length).toBeLessThanOrEqual(12)
  })

  it('setChrome merges into the existing override without clobbering other fields', () => {
    const { result } = setup()
    act(() => result.current.setChrome('dark', { background: '#000000' }))
    act(() => result.current.setChrome('dark', { foreground: '#ffffff' }))
    expect(result.current.chromeFor('dark')).toEqual({ background: '#000000', foreground: '#ffffff' })
  })

  it('resetAll restores every field to first-load defaults', () => {
    const { result } = setup()
    act(() => {
      result.current.setMode('dark')
      result.current.setColor('keyword', '#ff0000')
      result.current.setChrome('dark', { background: '#000000' })
      result.current.setThemeName('Custom')
    })
    act(() => result.current.resetAll())
    expect(result.current.mode).toBe('light')
    expect(result.current.assignments.size).toBe(0)
    expect(result.current.chromeFor('dark')).toEqual({})
    expect(result.current.themeName).toBe(DEFAULT_THEME_NAME)
    expect(result.current.recentColors).toEqual([])
  })

  it('throws when used outside a provider', () => {
    expect(() => renderHook(() => useAssignments())).toThrow(/useAssignments must be used within/)
  })

  describe('importTheme', () => {
    it('replaces both modes wholesale, clearing a mode the incoming theme leaves undefined', () => {
      const { result } = setup()
      // Simulate an earlier import that set up both dark and light.
      act(() => {
        result.current.setColor('keyword', '#111111', 'dark')
        result.current.setColor('string', '#222222', 'light')
        result.current.setChrome('light', { background: '#eeeeee' })
      })

      // A second, dark-only theme (the common case — most Marketplace
      // themes ship one variant) must fully replace the first, not merge
      // into it — light should end up empty, not keep '#222222'.
      act(() => {
        result.current.importTheme({
          name: 'Dark Only Theme',
          variants: [{ mode: 'dark', chrome: { background: '#000000' }, assignments: new Map([['keyword', '#ff0000']]) }],
        })
      })

      expect(result.current.assignmentsFor('dark')).toEqual(new Map([['keyword', '#ff0000']]))
      expect(result.current.assignmentsFor('light').size).toBe(0)
      expect(result.current.chromeFor('dark')).toEqual({ background: '#000000' })
      expect(result.current.chromeFor('light')).toEqual({})
      expect(result.current.themeName).toBe('Dark Only Theme')
      expect(result.current.mode).toBe('dark')
    })

    it('clears recent colors — the picker should not show swatches from a theme that was just replaced', () => {
      const { result } = setup()
      act(() => {
        result.current.setColor('keyword', '#111111', 'dark')
        result.current.setColor('string', '#222222', 'dark')
      })
      expect(result.current.recentColors.length).toBeGreaterThan(0)

      act(() => {
        result.current.importTheme({
          name: 'Fresh Theme',
          variants: [{ mode: 'dark', chrome: {}, assignments: new Map([['keyword', '#ff0000']]) }],
        })
      })

      expect(result.current.recentColors).toEqual([])
    })

    it('sets both modes from a two-variant theme', () => {
      const { result } = setup()
      act(() => {
        result.current.importTheme({
          name: 'Two Variant Theme',
          variants: [
            { mode: 'dark', chrome: {}, assignments: new Map([['keyword', '#111111']]) },
            { mode: 'light', chrome: {}, assignments: new Map([['keyword', '#222222']]) },
          ],
        })
      })
      expect(result.current.assignmentsFor('dark').get('keyword')).toBe('#111111')
      expect(result.current.assignmentsFor('light').get('keyword')).toBe('#222222')
    })

    it('uses the imported theme\'s own name by default', () => {
      const { result } = setup()
      act(() => {
        result.current.importTheme({
          name: 'Dracula Official',
          variants: [{ mode: 'dark', chrome: {}, assignments: new Map() }],
        })
      })
      expect(result.current.themeName).toBe('Dracula Official')
    })

    it('uses themeNameOverride instead of the imported theme\'s name when given one', () => {
      const { result } = setup()
      act(() => {
        result.current.importTheme(
          { name: 'Dracula Official', variants: [{ mode: 'dark', chrome: {}, assignments: new Map() }] },
          DEFAULT_THEME_NAME,
        )
      })
      expect(result.current.themeName).toBe(DEFAULT_THEME_NAME)
    })
  })

  describe('autosave', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('wasRestored is false on a fresh session', () => {
      const { result } = setup()
      expect(result.current.wasRestored).toBe(false)
    })

    it('restores mode, assignments, chrome, and theme name from a saved session', () => {
      savePersistedTheme({
        version: 1,
        mode: 'dark',
        themeName: 'Restored Theme',
        assignments: { dark: [['keyword', '#ff0000']], light: [] },
        chrome: { dark: { background: '#000000' }, light: {} },
      })
      const { result } = setup()
      expect(result.current.wasRestored).toBe(true)
      expect(result.current.mode).toBe('dark')
      expect(result.current.themeName).toBe('Restored Theme')
      expect(result.current.assignmentsFor('dark').get('keyword')).toBe('#ff0000')
      expect(result.current.chromeFor('dark')).toEqual({ background: '#000000' })
    })

    it('wasRestored is false for a saved-but-empty session', () => {
      savePersistedTheme({ version: 1, mode: 'light', themeName: DEFAULT_THEME_NAME, assignments: {}, chrome: {} })
      const { result } = setup()
      expect(result.current.wasRestored).toBe(false)
    })

    it('debounces writes and persists the latest state', () => {
      vi.useFakeTimers()
      const { result } = setup()
      act(() => {
        result.current.setColor('keyword', '#00ff00', 'dark')
      })
      // Still within the debounce window — nothing written yet.
      expect(loadPersistedTheme()).toBeNull()

      act(() => {
        vi.advanceTimersByTime(600)
      })
      const saved = loadPersistedTheme()
      expect(saved?.assignments.dark).toEqual([['keyword', '#00ff00']])
    })

    it('resetAll clears the persisted session', () => {
      vi.useFakeTimers()
      const { result } = setup()
      act(() => {
        result.current.setColor('keyword', '#00ff00', 'dark')
      })
      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(loadPersistedTheme()).not.toBeNull()

      act(() => result.current.resetAll())
      expect(loadPersistedTheme()).toBeNull()
    })
  })
})
