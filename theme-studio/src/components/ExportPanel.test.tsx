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
  const { setProductThemeName, setPairedIconTheme } = useAssignments()
  return (
    <>
      <button onClick={() => setProductThemeName('Midnight')}>select preset</button>
      <button onClick={() => setPairedIconTheme(MATERIAL_ICON_THEME)}>pair icon theme</button>
      <button onClick={() => setPairedIconTheme(null)}>unpair icon theme</button>
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
