import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LANGUAGES } from '../data/languages'
import { AssignmentsProvider } from '../store/AssignmentsContext'
import { useAssignments } from '../store/useAssignments'
import { ROLE_SCOPES } from '../theme/presetPalette'
import { PresetPicker } from './PresetPicker'

// Every preset now defines every role's field, so applying any preset
// assigns this many scopes — computed from the data, not hardcoded, so it
// doesn't silently drift out of sync if a role is added or removed.
const TOTAL_PRESET_SCOPES = Object.values(ROLE_SCOPES).reduce((sum, { scopes }) => sum + scopes.length, 0)

// A thin consumer so the test can read/seed assignments state directly,
// the same way App.tsx and the real panels do via useAssignments.
function Harness({ onApplied }: { onApplied?: (message: string) => void }) {
  const { assignmentsFor, setColor, setMode } = useAssignments()
  return (
    <div>
      <button
        onClick={() => {
          setMode('dark')
          setColor('type', '#abcdef', 'dark')
        }}
      >
        Color a type token by hand
      </button>
      <button
        onClick={() => {
          setMode('light')
          setColor('type', '#123456', 'light')
        }}
      >
        Color a light type token by hand
      </button>
      <div data-testid="dark-count">{assignmentsFor('dark').size}</div>
      <div data-testid="has-type">{String(assignmentsFor('dark').has('type'))}</div>
      <div data-testid="light-count">{assignmentsFor('light').size}</div>
      <PresetPicker onApplied={onApplied} language={LANGUAGES[0]} code="" />
    </div>
  )
}

function setup() {
  const onApplied = vi.fn()
  render(
    <AssignmentsProvider>
      <Harness onApplied={onApplied} />
    </AssignmentsProvider>,
  )
  return { onApplied }
}

describe('PresetPicker', () => {
  it('applying a preset clears every prior color in that mode, not just the scopes the preset defines', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a type token by hand' }))
    expect(screen.getByTestId('has-type')).toHaveTextContent('true')

    // Dark mode already has a hand-colored scope, so this opens a confirm
    // dialog instead of applying outright — confirm it to get through.
    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    await user.click(screen.getByRole('button', { name: 'Apply preset' }))
    // "type" isn't one of the ~160 scopes any preset role defines, so it
    // must be gone once the preset's full scope set replaces it.
    expect(screen.getByTestId('has-type')).toHaveTextContent('false')
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('opens a confirm dialog instead of applying immediately when it would overwrite an existing theme, then applies on confirm', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))

    // Night Owl is also a dark preset — applying it now would overwrite Tokyo Night's colors.
    await user.click(screen.getByTitle(/^Apply the Night Owl preset/))
    const dialog = screen.getByRole('alertdialog', { name: 'Replace your current theme?' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Night Owl')
    // Nothing applied yet — still Tokyo Night's colors, untouched until confirmed.
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))

    await user.click(screen.getByRole('button', { name: 'Apply preset' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Every preset now defines every role, so the count is the same as
    // before — it's a full swap, not a partial one.
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('cancelling the confirm dialog leaves the existing theme untouched', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    await user.click(screen.getByTitle(/^Apply the Night Owl preset/))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Still Tokyo Night — Night Owl was never applied.
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('applying a preset also clears the other mode — only one theme is ever in progress at a time', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a light type token by hand' }))
    expect(screen.getByTestId('light-count')).toHaveTextContent('1')

    // Light mode has hand-colored work, so applying a dark preset opens the confirm dialog.
    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    await user.click(screen.getByRole('button', { name: 'Apply preset' }))

    // Tokyo Night only defines a dark variant — light must be wiped, not left mixed in.
    expect(screen.getByTestId('light-count')).toHaveTextContent('0')
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('applies immediately, with no confirm dialog, when the mode has nothing to lose yet', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })
})

describe('PresetPicker onApplied notification', () => {
  it('reports a message the moment a preset is applied directly, with nothing to overwrite', async () => {
    const user = userEvent.setup()
    const { onApplied } = setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onApplied).toHaveBeenCalledWith(expect.stringContaining('Tokyo Night'))
  })

  it('reports a message only after the overwrite confirm dialog is actually confirmed, not on the click that opened it', async () => {
    const user = userEvent.setup()
    const { onApplied } = setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    onApplied.mockClear()

    await user.click(screen.getByTitle(/^Apply the Night Owl preset/))
    expect(onApplied).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Apply preset' }))
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onApplied).toHaveBeenCalledWith(expect.stringContaining('Night Owl'))
  })

  it('does not report anything when the confirm dialog is cancelled', async () => {
    const user = userEvent.setup()
    const { onApplied } = setup()

    await user.click(screen.getByTitle(/^Apply the Tokyo Night preset/))
    onApplied.mockClear()

    await user.click(screen.getByTitle(/^Apply the Night Owl preset/))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onApplied).not.toHaveBeenCalled()
  })
})
