import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from './track'

afterEach(() => {
  delete window.plausible
  vi.restoreAllMocks()
})

describe('track', () => {
  it('does nothing when window.plausible is not present', () => {
    expect(() => track('app_loaded')).not.toThrow()
  })

  it('forwards the event name and props to window.plausible when present', () => {
    const plausible = vi.fn()
    window.plausible = plausible
    track('language_selected', { language: 'python' })
    expect(plausible).toHaveBeenCalledWith('language_selected', { props: { language: 'python' } })
  })

  it('omits the options object entirely when no props are given', () => {
    const plausible = vi.fn()
    window.plausible = plausible
    track('export_clicked')
    expect(plausible).toHaveBeenCalledWith('export_clicked', undefined)
  })

  it('never throws even if window.plausible itself throws', () => {
    window.plausible = () => {
      throw new Error('boom')
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => track('export_failed')).not.toThrow()
    expect(consoleError).toHaveBeenCalled()
  })
})
