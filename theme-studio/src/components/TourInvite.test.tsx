import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TourInvite } from './TourInvite'

describe('TourInvite', () => {
  it('renders as a non-modal status region, not a dialog', () => {
    render(<TourInvite onStart={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('calls onStart when "Take the tour" is clicked', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<TourInvite onStart={onStart} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Take the tour' }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when "No thanks" is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<TourInvite onStart={vi.fn()} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'No thanks' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<TourInvite onStart={vi.fn()} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
