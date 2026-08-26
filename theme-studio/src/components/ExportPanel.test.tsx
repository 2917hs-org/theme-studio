import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssignmentsProvider, useAssignments } from '../store/AssignmentsContext'
import { ExportPanel } from './ExportPanel'

const MATERIAL_ICON_THEME = {
  publisherName: 'pkief',
  extensionName: 'material-icon-theme',
  displayName: 'Material Icon Theme',
  iconUrl: null,
  vsixUrl: null,
}

// Mirrors what PresetPicker/ImportThemeDialog actually call — this test
// exercises the real context, not a mock, since the auto-fill behavior
// under test lives partly in AssignmentsContext (productThemeName) and
// partly in ExportPanel's own effect (the divergence check).
function Harness() {
  const { setProductThemeName, setPairedIconTheme, setColor } = useAssignments()
  return (
    <>
      <button onClick={() => setProductThemeName('Midnight')}>select preset</button>
      <button onClick={() => setPairedIconTheme(MATERIAL_ICON_THEME)}>pair icon theme</button>
      <button onClick={() => setPairedIconTheme(null)}>unpair icon theme</button>
      <button onClick={() => setColor('comment', '#ff0000', 'dark')}>color dark</button>
      <button onClick={() => setColor('comment', '#00ff00', 'light')}>color light</button>
    </>
  )
}

function renderPanel() {
  return render(
    <AssignmentsProvider>
      <Harness />
      <ExportPanel />
    </AssignmentsProvider>,
  )
}

function nameInput() {
  return screen.getByLabelText('Theme name') as HTMLInputElement
}

describe('ExportPanel theme name auto-fill', () => {
  it('defaults to "vsts" with nothing selected', () => {
    renderPanel()
    expect(nameInput().value).toBe('vsts')
  })

  it('fills in the product theme the moment one is selected', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    expect(nameInput().value).toBe('vsts-midnight')
  })

  it('keeps updating live as the icon theme pairing changes, while still auto-tracking', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    await user.click(screen.getByText('pair icon theme'))
    expect(nameInput().value).toBe('vsts-midnight-material-icon-theme')

    await user.click(screen.getByText('unpair icon theme'))
    expect(nameInput().value).toBe('vsts-midnight')
  })

  it('stops auto-updating once the user types a custom name', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))

    const input = nameInput()
    await user.clear(input)
    await user.type(input, 'My Own Name')
    expect(nameInput().value).toBe('My Own Name')

    // A later selection change must not clobber the custom text.
    await user.click(screen.getByText('pair icon theme'))
    expect(nameInput().value).toBe('My Own Name')
  })

  it('leaves the field empty (not force-refilled) if the user clears it with nothing else changing', async () => {
    const user = userEvent.setup()
    renderPanel()
    const input = nameInput()
    await user.clear(input)
    // Deliberately does NOT snap back to "vsts" here — see the comment in
    // ExportPanel.tsx: only a change in what's *selected* re-triggers the
    // auto-fill, precisely so an in-progress edit (clear, then retype) is
    // never interrupted mid-keystroke. The "vsts" default still applies at
    // export time regardless (buildCurrentVsix falls back to it).
    expect(nameInput().value).toBe('')

    // Re-typing after clearing must produce exactly what was typed, not the
    // old auto value with new characters appended onto it.
    await user.type(input, 'Fresh Name')
    expect(nameInput().value).toBe('Fresh Name')
  })
})

function downloadButton() {
  return screen.getByRole('button', { name: /download theme/i })
}

function filenamePreview() {
  return screen.queryByText(/\.vsix$/)
}

describe('ExportPanel mode suffix', () => {
  it('appends the mode when only one has been colored', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    await user.click(screen.getByText('color dark'))
    expect(nameInput().value).toBe('vsts-midnight-dark')
  })

  it('omits the mode once both are colored — a two-variant pack, not "the dark one"', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    await user.click(screen.getByText('color dark'))
    await user.click(screen.getByText('color light'))
    expect(nameInput().value).toBe('vsts-midnight')
  })

  it('does not stamp a mode onto the untouched default before anything is colored', () => {
    renderPanel()
    expect(nameInput().value).toBe('vsts')
  })
})

describe('ExportPanel name validation and filename alignment', () => {
  it('disables export and explains why when nothing is colored yet', () => {
    renderPanel()
    expect(downloadButton()).toBeDisabled()
    expect(screen.getByText(/color at least one token/i)).toBeInTheDocument()
  })

  it('disables export and explains why when the name is cleared, even with colors present', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('color dark'))
    expect(downloadButton()).not.toBeDisabled()

    await user.clear(nameInput())
    expect(downloadButton()).toBeDisabled()
    expect(screen.getByText(/give your theme a name/i)).toBeInTheDocument()
  })

  it('treats a whitespace-only name the same as empty', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('color dark'))
    await user.clear(nameInput())
    await user.type(nameInput(), '   ')
    expect(downloadButton()).toBeDisabled()
  })

  it('shows a filename preview that exactly matches the slugified box text, while auto-tracking', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    await user.click(screen.getByText('color dark'))
    expect(nameInput().value).toBe('vsts-midnight-dark')
    expect(filenamePreview()?.textContent).toBe('vsts-midnight-dark.vsix')
  })

  it('shows a filename preview that exactly matches the slugified box text, after a custom rename', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByText('select preset'))
    await user.click(screen.getByText('color dark'))

    const input = nameInput()
    await user.clear(input)
    await user.type(input, 'My Own Name')
    // The box keeps the friendly, unslugified text the user actually
    // typed — only the filename preview (and the real download) reduce it
    // to a slug. That's the one deliberate gap: this file always matches
    // the box's *slugified* form, never its literal casing/spacing.
    expect(nameInput().value).toBe('My Own Name')
    expect(filenamePreview()?.textContent).toBe('my-own-name.vsix')
  })
})
