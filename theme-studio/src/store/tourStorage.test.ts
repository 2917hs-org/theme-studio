import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dismissTour, hasTourBeenDismissed } from './tourStorage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('hasTourBeenDismissed / dismissTour', () => {
  it('defaults to false — the tour shows until explicitly dismissed', () => {
    expect(hasTourBeenDismissed()).toBe(false)
  })

  it('is true after dismissTour is called', () => {
    dismissTour()
    expect(hasTourBeenDismissed()).toBe(true)
  })

  it('ignores unrelated or corrupted storage values', () => {
    localStorage.setItem('theme-studio:tour-dismissed:v1', 'true')
    expect(hasTourBeenDismissed()).toBe(false)
  })
})
