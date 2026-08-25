import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentsProvider, useAssignments } from '../store/AssignmentsContext'
import { ExportPanel } from './ExportPanel'

// A thin consumer so the test can seed assignments state directly, the same
// way App.tsx does via useAssignments — ExportPanel itself has no way to
// color a scope, it only reads what's already assigned.
function Harness() {
  const { setColor } = useAssignments()
  return (
    <div>
      <button onClick={() => setColor('type', '#abcdef', 'dark')}>Color a token</button>
      <ExportPanel />
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

describe('ExportPanel', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('disables both export actions until at least one scope is colored', () => {
    setup()
    expect(screen.getByRole('button', { name: /Download theme/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Get install command/ })).toBeDisabled()
    expect(screen.getByText('Color at least one token to enable export.')).toBeInTheDocument()
  })

  it('enables export and packages a .vsix once a scope is colored', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    const downloadBtn = screen.getByRole('button', { name: /Download theme/ })
    expect(downloadBtn).toBeEnabled()

    await user.click(downloadBtn)

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/zip')
    expect(screen.getByRole('button', { name: /Downloaded/ })).toBeInTheDocument()
  })

  it('reverts the "Downloaded" confirmation back to "Download theme" after the timeout', async () => {
    // shouldAdvanceTime keeps real wall-clock time flowing for user-event's
    // own internal waits while still letting us fast-forward the component's
    // setTimeout, so `await user.click` doesn't hang waiting on fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    await user.click(screen.getByRole('button', { name: /Download theme/ }))
    expect(screen.getByRole('button', { name: /Downloaded/ })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2900)
    })
    expect(screen.getByRole('button', { name: /^Download theme$/ })).toBeInTheDocument()
  })

  it('typing a theme name updates the input and the exporting summary stays in sync', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    const nameInput = screen.getByLabelText('Theme name')
    await user.clear(nameInput)
    await user.type(nameInput, 'My Custom Theme')

    expect(nameInput).toHaveValue('My Custom Theme')
    expect(screen.getByText(/Exporting Dark/)).toBeInTheDocument()
  })

  it('shows an inline error instead of crashing when packaging the .vsix fails', async () => {
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('boom')
    })
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    await user.click(screen.getByRole('button', { name: /Download theme/ }))

    expect(screen.getByText('Something went wrong generating the file. Please try again.')).toBeInTheDocument()
    // The button must not get stuck in a permanent "Building…" state after the failure.
    expect(screen.getByRole('button', { name: /^Download theme$/ })).toBeEnabled()
  })

  it('"Get install command" downloads the file and shows the one-line install command', async () => {
    // user-event installs its own clipboard stub during setup() — define ours after, so it wins.
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    await user.click(screen.getByRole('button', { name: /Get install command/ }))

    await waitFor(() => expect(screen.getByText(/code --install-extension/)).toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('code --install-extension'))
    expect(screen.getByText(/already copied to your clipboard/)).toBeInTheDocument()
  })

  it('falls back to a manual-copy hint when the clipboard write is denied', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup()

    await user.click(screen.getByRole('button', { name: 'Color a token' }))
    await user.click(screen.getByRole('button', { name: /Get install command/ }))

    await waitFor(() => expect(screen.getByText(/Couldn't copy automatically/)).toBeInTheDocument())
  })
})
