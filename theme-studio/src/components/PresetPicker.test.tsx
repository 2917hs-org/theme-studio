import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../data/languages'
import { AssignmentsProvider, useAssignments } from '../store/AssignmentsContext'
import { ROLE_SCOPES } from '../theme/presetPalette'
import { PresetPicker } from './PresetPicker'

// Every preset now defines every role's field, so applying any preset
// assigns this many scopes — computed from the data, not hardcoded, so it
// doesn't silently drift out of sync if a role is added or removed.
const TOTAL_PRESET_SCOPES = Object.values(ROLE_SCOPES).reduce((sum, { scopes }) => sum + scopes.length, 0)

// A thin consumer so the test can read/seed assignments state directly,
// the same way App.tsx and the real panels do via useAssignments.
function Harness() {
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
      <div data-testid="dark-count">{assignmentsFor('dark').size}</div>
      <div data-testid="has-type">{String(assignmentsFor('dark').has('type'))}</div>
      <PresetPicker language={LANGUAGES[0]} code="" />
    </div>
  )
}

function setup() {
  return render(
    <AssignmentsProvider>
      <Harness />
    </AssignmentsProvider>,
  )
}

describe('PresetPicker', () => {
  it('applying a preset clears every prior color in that mode, not just the scopes the preset defines', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a type token by hand' }))
    expect(screen.getByTestId('has-type')).toHaveTextContent('true')

    // Dark mode already has a hand-colored scope, so this opens a confirm
    // dialog instead of applying outright — confirm it to get through.
    await user.click(screen.getByTitle('Apply the Dark Navy preset'))
    await user.click(screen.getByRole('button', { name: 'Apply preset' }))
    // "type" isn't one of the ~160 scopes any preset role defines, so it
    // must be gone once the preset's full scope set replaces it.
    expect(screen.getByTestId('has-type')).toHaveTextContent('false')
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('opens a confirm dialog instead of applying immediately when it would overwrite an existing theme, then applies on confirm', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTitle('Apply the Dark Navy preset'))
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))

    // Midnight is also a dark preset — applying it now would overwrite Dark Navy's colors.
    await user.click(screen.getByTitle('Apply the Midnight preset'))
    const dialog = screen.getByRole('alertdialog', { name: 'Replace your dark theme?' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Midnight')
    // Nothing applied yet — still Dark Navy's colors, untouched until confirmed.
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

    await user.click(screen.getByTitle('Apply the Dark Navy preset'))
    await user.click(screen.getByTitle('Apply the Midnight preset'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // Still Dark Navy — Midnight was never applied.
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })

  it('applies immediately, with no confirm dialog, when the mode has nothing to lose yet', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTitle('Apply the Dark Navy preset'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('dark-count')).toHaveTextContent(String(TOTAL_PRESET_SCOPES))
  })
})
