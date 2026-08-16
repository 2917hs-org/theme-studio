import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssignmentsProvider, DEFAULT_THEME_NAME, useAssignments } from './AssignmentsContext'

function setup() {
  return renderHook(() => useAssignments(), { wrapper: AssignmentsProvider })
}

describe('AssignmentsContext', () => {
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
})
