import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGES } from '../data/languages'
import { AssignmentsProvider } from '../store/AssignmentsContext'
import { useAssignments } from '../store/useAssignments'
import type { MarketplaceThemeResult } from '../marketplace/searchMarketplace'
import { ImportThemeDialog, type ImportTab } from './ImportThemeDialog'

vi.mock('../marketplace/searchMarketplace', async () => {
  const actual = await vi.importActual<typeof import('../marketplace/searchMarketplace')>('../marketplace/searchMarketplace')
  return {
    ...actual,
    searchMarketplaceThemes: vi.fn(),
    fetchMarketplaceVsix: vi.fn(),
  }
})

// A real mouse click on "Use" hovers the row first (same as a real user
// would), which mounts ThemePreview and reaches for the real TextMate
// grammar/WASM over the network — unrelated to what this file tests, and
// unavailable in the jsdom test environment. Stub it out at the tokenizer
// boundary rather than the fetch layer, so it can't leak an unhandled
// rejection when that fetch fails.
vi.mock('../textmate/previewTokenize', () => ({
  tokenizeForPreview: vi.fn().mockResolvedValue([]),
}))

import { fetchMarketplaceVsix, searchMarketplaceThemes } from '../marketplace/searchMarketplace'

const searchMarketplaceThemesMock = vi.mocked(searchMarketplaceThemes)
const fetchMarketplaceVsixMock = vi.mocked(fetchMarketplaceVsix)

function jsonFile(name: string, data: unknown): File {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

const SAMPLE_THEME = {
  name: 'Dracula Official',
  type: 'dark',
  colors: { 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2' },
  tokenColors: [{ scope: 'comment', settings: { foreground: '#6272a4' } }],
}

function marketplaceResult(overrides: Partial<MarketplaceThemeResult> = {}): MarketplaceThemeResult {
  return {
    publisherName: 'dracula-theme',
    publisherDisplayName: 'Dracula Theme',
    extensionName: 'theme-dracula',
    displayName: 'Dracula Official',
    shortDescription: 'A dark theme',
    iconUrl: null,
    installCount: 12345,
    version: '1.0.0',
    vsixUrl: 'https://example.invalid/dracula.vsix',
    ...overrides,
  }
}

// A thin consumer so a test can seed existing color assignments before the
// dialog under test ever mounts — real usage always has some other panel
// (ColorPicker, PresetPicker, ...) that could have put work in progress there.
function SeedButton() {
  const { setColor } = useAssignments()
  return <button onClick={() => setColor('type', '#abcdef', 'dark')}>Seed existing work</button>
}

function setup(props: { initialTab?: ImportTab; seedExisting?: boolean } = {}) {
  const { seedExisting, ...dialogProps } = props
  const onClose = vi.fn()
  const onImported = vi.fn()
  render(
    <AssignmentsProvider>
      {seedExisting && <SeedButton />}
      <ImportThemeDialog onClose={onClose} onImported={onImported} language={LANGUAGES[0]} code="const x = 1;" {...dialogProps} />
    </AssignmentsProvider>,
  )
  return { onClose, onImported }
}

describe('ImportThemeDialog — upload tab', () => {
  it('imports a valid theme file immediately when there is nothing to overwrite', async () => {
    const user = userEvent.setup()
    const { onClose, onImported } = setup()

    const input = screen.getByLabelText('Choose a VS Code theme file')
    await user.upload(input, jsonFile('dracula.json', SAMPLE_THEME))

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1))
    expect(onImported.mock.calls[0][0]).toContain('Dracula Official')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an inline error and does not close the dialog when the file is not a recognizable theme', async () => {
    const user = userEvent.setup()
    const { onClose, onImported } = setup()

    const input = screen.getByLabelText('Choose a VS Code theme file')
    await user.upload(input, jsonFile('not-a-theme.json', { hello: 'world' }))

    expect(await screen.findByText('Not a valid VS Code theme file — missing "tokenColors" and "colors".')).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('routes through a confirm dialog instead of importing immediately when existing work would be overwritten', async () => {
    const user = userEvent.setup()
    const { onClose, onImported } = setup({ seedExisting: true })
    await user.click(screen.getByRole('button', { name: 'Seed existing work' }))

    const input = screen.getByLabelText('Choose a VS Code theme file')
    await user.upload(input, jsonFile('dracula.json', SAMPLE_THEME))

    const dialog = await screen.findByRole('alertdialog', { name: 'Import "Dracula Official"?' })
    expect(within(dialog).getByText(/replaces all of your current color assignments/)).toBeInTheDocument()
    expect(onImported).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Import & replace' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ImportThemeDialog — search tab', () => {
  beforeEach(() => {
    searchMarketplaceThemesMock.mockReset()
    fetchMarketplaceVsixMock.mockReset()
  })

  it('searches after the debounce and renders results', async () => {
    searchMarketplaceThemesMock.mockResolvedValue([marketplaceResult()])
    // The result list also kicks off a background prefetch (for the swatch/hover
    // preview) using this same mock — give it something to resolve or the row
    // gets marked 'failed' and filtered out of view before the assertions run.
    fetchMarketplaceVsixMock.mockResolvedValue(jsonFile('dracula.json', SAMPLE_THEME))
    const user = userEvent.setup()
    setup({ initialTab: 'search' })

    await user.type(screen.getByLabelText('Search the VS Code Marketplace for a theme'), 'dracula')

    await waitFor(() => expect(searchMarketplaceThemesMock).toHaveBeenCalledWith('dracula'))
    expect(await screen.findByText('Dracula Official')).toBeInTheDocument()
    expect(screen.getByText('by Dracula Theme')).toBeInTheDocument()
  })

  it('shows a Marketplace-specific error message when the search fails', async () => {
    const { MarketplaceError } = await import('../marketplace/searchMarketplace')
    searchMarketplaceThemesMock.mockRejectedValue(new MarketplaceError('The Marketplace is unreachable right now.'))
    const user = userEvent.setup()
    setup({ initialTab: 'search' })

    await user.type(screen.getByLabelText('Search the VS Code Marketplace for a theme'), 'dracula')

    expect(await screen.findByText('The Marketplace is unreachable right now.')).toBeInTheDocument()
  })

  it('shows "no themes found" for an empty result set', async () => {
    searchMarketplaceThemesMock.mockResolvedValue([])
    const user = userEvent.setup()
    setup({ initialTab: 'search' })

    await user.type(screen.getByLabelText('Search the VS Code Marketplace for a theme'), 'zzzznotarealtheme')

    expect(await screen.findByText(/No themes found for "zzzznotarealtheme"/)).toBeInTheDocument()
  })

  it('clicking "Use" downloads and imports the selected result', async () => {
    const result = marketplaceResult()
    searchMarketplaceThemesMock.mockResolvedValue([result])
    fetchMarketplaceVsixMock.mockResolvedValue(jsonFile('dracula.json', SAMPLE_THEME))
    const user = userEvent.setup()
    const onImported = vi.fn()
    const onClose = vi.fn()
    render(
      <AssignmentsProvider>
        <ImportThemeDialog onClose={onClose} onImported={onImported} initialTab="search" language={LANGUAGES[0]} code="const x = 1;" />
      </AssignmentsProvider>,
    )

    await user.type(screen.getByLabelText('Search the VS Code Marketplace for a theme'), 'dracula')
    await screen.findByText('Dracula Official')

    await user.click(screen.getByRole('button', { name: 'Use' }))

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1))
    expect(fetchMarketplaceVsixMock).toHaveBeenCalledWith(result)
    // A Marketplace "Use" keeps the dialog open — unlike a file upload —
    // so you can still switch to the Icon Theme tab and pair one next.
    expect(onClose).not.toHaveBeenCalled()
    expect(onImported.mock.calls[0][0]).toContain('Dracula Official')
  })

  it('shows a per-result error when the "Use" download fails, without closing the dialog', async () => {
    const result = marketplaceResult()
    searchMarketplaceThemesMock.mockResolvedValue([result])
    // handleUseResult re-fetches independently of the cache the background
    // prefetch effect fills — let the prefetch succeed (so the row stays
    // visible with a "Use" button) and fail only the second, "Use"-triggered call.
    fetchMarketplaceVsixMock.mockResolvedValueOnce(jsonFile('dracula.json', SAMPLE_THEME))
    fetchMarketplaceVsixMock.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    const { onClose } = setup({ initialTab: 'search' })

    await user.type(screen.getByLabelText('Search the VS Code Marketplace for a theme'), 'dracula')
    await screen.findByText('Dracula Official')

    await user.click(await screen.findByRole('button', { name: 'Use' }))

    expect(await screen.findByText('Could not import "Dracula Official".')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
