import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTourBeenDismissed } from '../store/tourStorage'
import { SiteTour } from './SiteTour'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('SiteTour', () => {
  it('opens on the welcome step, centered with no spotlight target', () => {
    render(<SiteTour onDone={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Welcome to VS Code Theme Studio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('steps forward through Next and back through Back', async () => {
    const user = userEvent.setup()
    render(<SiteTour onDone={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('dialog', { name: 'Start with a preset' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('dialog', { name: 'Welcome to VS Code Theme Studio' })).toBeInTheDocument()
  })

  it('calls onDone without persisting dismissal when finished with the checkbox unchecked', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<SiteTour onDone={onDone} />)
    // Click Next until the last step swaps the label to Done — deliberately
    // not hardcoding the step count so this doesn't silently stop covering
    // the real last step whenever a step is added or removed.
    while (screen.queryByRole('button', { name: 'Next' })) {
      await user.click(screen.getByRole('button', { name: 'Next' }))
    }
    const doneBtn = screen.getByRole('button', { name: 'Done' })
    await user.click(doneBtn)
    expect(onDone).toHaveBeenCalledOnce()
    expect(hasTourBeenDismissed()).toBe(false)
  })

  it('persists dismissal when "don\'t show this tour again" is checked before finishing', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<SiteTour onDone={onDone} />)
    await user.click(screen.getByRole('checkbox', { name: "Don't show this tour again" }))
    await user.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(onDone).toHaveBeenCalledOnce()
    expect(hasTourBeenDismissed()).toBe(true)
  })

  it('skips on Escape without persisting dismissal by default', () => {
    const onDone = vi.fn()
    render(<SiteTour onDone={onDone} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDone).toHaveBeenCalledOnce()
    expect(hasTourBeenDismissed()).toBe(false)
  })

  it('skips when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    const { container } = render(<SiteTour onDone={onDone} />)
    await user.click(container.querySelector('.tour-click-catcher')!)
    expect(onDone).toHaveBeenCalledOnce()
  })
})
