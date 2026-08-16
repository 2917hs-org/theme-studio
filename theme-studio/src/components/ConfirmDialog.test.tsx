import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title, body, and labeled actions', () => {
    render(
      <ConfirmDialog title="Reset everything?" body="This clears everything." confirmLabel="Reset" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByRole('alertdialog', { name: 'Reset everything?' })).toBeInTheDocument()
    expect(screen.getByText('This clears everything.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('autofocuses the cancel button so an accidental Enter cannot confirm', () => {
    render(<ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when clicking the overlay but not the dialog itself', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('alertdialog').parentElement!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('traps Tab within the dialog instead of letting focus escape to the page', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button>Outside</button>
        <ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </div>,
    )
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(cancelBtn).toHaveFocus()

    await user.tab()
    expect(confirmBtn).toHaveFocus()

    // Tab from the last focusable element wraps back to the first instead
    // of leaving the dialog for "Outside".
    await user.tab()
    expect(cancelBtn).toHaveFocus()

    await user.tab({ shift: true })
    expect(confirmBtn).toHaveFocus()
  })

  it('returns focus to the element that opened the dialog once it unmounts', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && <ConfirmDialog title="t" body="b" confirmLabel="Confirm" onConfirm={vi.fn()} onCancel={() => setOpen(false)} />}
        </div>
      )
    }
    render(<Harness />)
    const openBtn = screen.getByRole('button', { name: 'Open' })
    openBtn.focus()
    fireEvent.click(openBtn)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(openBtn).toHaveFocus()
  })
})
