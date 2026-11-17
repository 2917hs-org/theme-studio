import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGES } from '../data/languages'
import { AssignmentsProvider } from '../store/AssignmentsContext'
import { useAssignments } from '../store/useAssignments'
import { tokenizeForPreview } from '../textmate/previewTokenize'
import { MIN_PREVIEW_LINES, padToMinLines } from '../theme/prompt/previewCode'
import { DescribeThemeDialog } from './DescribeThemeDialog'

// The real tokenizer needs the TextMate grammar + WASM over fetch. This stand-in
// keeps what matters for these tests — it receives the exact assignments and
// code the preview is asked to render — and turns each line into one token.
vi.mock('../textmate/previewTokenize', () => ({
  tokenizeForPreview: vi.fn(async (_def: unknown, code: string) => code.split('\n').map((line) => [{ text: line, color: '#abcdef' }])),
}))

const language = LANGUAGES[0]
const sampleCode = language.generate(1)

function Harness({ onApplied, onClose = () => {}, willReplaceTheme = false, code = sampleCode, lang = language }: { onApplied?: (m: string) => void; onClose?: () => void; willReplaceTheme?: boolean; code?: string; lang?: typeof language }) {
  const { assignmentsFor, chromeFor, mode } = useAssignments()
  return (
    <div>
      <div data-testid="count">{assignmentsFor(mode).size}</div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="bg">{chromeFor(mode).background ?? ''}</div>
      <div data-testid="assigned">{JSON.stringify([...assignmentsFor(mode)].sort())}</div>
      <DescribeThemeDialog onClose={onClose} onApplied={onApplied} willReplaceTheme={willReplaceTheme} language={lang} code={code} />
    </div>
  )
}

function renderDialog(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <AssignmentsProvider>
      <Harness {...props} />
    </AssignmentsProvider>,
  )
}

const input = () => screen.getByRole('textbox', { name: 'Describe the theme you want' })
const options = () => screen.findAllByRole('radio')
const previewCalls = () => vi.mocked(tokenizeForPreview).mock.calls
const lastPreviewAssignments = () => JSON.stringify([...previewCalls().at(-1)![2]].sort())

describe('DescribeThemeDialog', () => {
  beforeEach(() => {
    vi.mocked(tokenizeForPreview).mockClear()
  })

  it('shows three options as you type, with no Generate step, and applies the chosen one', async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn()
    const onClose = vi.fn()
    renderDialog({ onApplied, onClose })

    expect(screen.getByRole('button', { name: 'Use this theme' })).toBeDisabled()
    await user.type(input(), 'dark theme, low stress on eyes')

    const radios = await options()
    expect(radios).toHaveLength(3)
    expect(radios[0]).toBeChecked()
    expect(screen.getByText(/dark mode/)).toBeInTheDocument()
    expect(screen.getByText(/easy to read/)).toBeInTheDocument()
    expect(screen.getByTestId('count')).toHaveTextContent('0') // nothing applied until you choose

    await user.click(screen.getByRole('button', { name: 'Use this theme' }))
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(100)
    expect(screen.getByTestId('bg').textContent).toMatch(/^#[0-9a-f]{6}$/)
    expect(onApplied).toHaveBeenCalledWith(expect.stringMatching(/^Applied ".+"\.$/))
    expect(onClose).toHaveBeenCalled()
  })

  it('previews exactly the colors that get applied — what you see is what you get', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(input(), 'dark theme, low stress on eyes')
    await options()
    await waitFor(() => expect(previewCalls().length).toBeGreaterThan(0))

    const previewed = lastPreviewAssignments()
    await user.click(screen.getByRole('button', { name: 'Use this theme' }))
    expect(screen.getByTestId('assigned').textContent).toBe(previewed)
  })

  it('previews and applies the option you pick, not just the first', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(input(), 'dark theme')
    const radios = await options()
    await waitFor(() => expect(previewCalls().length).toBeGreaterThan(0))
    const firstPreviewed = lastPreviewAssignments()
    const firstLabel = screen.getByRole('group', { name: /Code preview in/ }).getAttribute('aria-label')

    await user.click(radios[2])
    expect(radios[2]).toBeChecked()
    await waitFor(() => expect(lastPreviewAssignments()).not.toBe(firstPreviewed))
    expect(screen.getByRole('group', { name: /Code preview in/ }).getAttribute('aria-label')).not.toBe(firstLabel)

    const pickedPreviewed = lastPreviewAssignments()
    await user.click(screen.getByRole('button', { name: 'Use this theme' }))
    expect(screen.getByTestId('assigned').textContent).toBe(pickedPreviewed)
  })

  it("renders the editor's own code sample, at least 20 lines of it", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(input(), 'dark theme')
    await options()
    await waitFor(() => expect(previewCalls().length).toBeGreaterThan(0))
    const [lang, code] = previewCalls().at(-1)!
    expect(lang).toBe(language)
    expect(code.split('\n').length).toBeGreaterThanOrEqual(MIN_PREVIEW_LINES)
    expect(code.startsWith(sampleCode)).toBe(true)
  })

  it('Enter applies the selected option', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog({ onClose })
    await user.type(input(), 'dark theme')
    await options()
    await user.type(input(), '{Enter}')
    expect(onClose).toHaveBeenCalled()
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(100)
  })

  it('quick picks write into the box and toggle off again', async () => {
    const user = userEvent.setup()
    renderDialog()
    const easy = screen.getByRole('button', { name: 'Easy on the eyes' })
    await user.click(easy)
    expect(input()).toHaveValue('easy on the eyes')
    expect(easy).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Forest' }))
    expect(input()).toHaveValue('easy on the eyes, forest')
    expect(await options()).toHaveLength(3)
    await user.click(easy)
    expect(input()).toHaveValue('forest')
    expect(easy).toHaveAttribute('aria-pressed', 'false')
  })

  it('opposite quick picks replace each other', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(input()).toHaveValue('light theme')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Warm' }))
    await user.click(screen.getByRole('button', { name: 'Cool' }))
    expect(input()).toHaveValue('light theme, cool')
  })

  it('gives a friendly nudge, not an error, when nothing is recognized', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(input(), 'xyzzy plugh')
    expect(await screen.findByRole('status')).toHaveTextContent(/nothing there I can work with/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Use this theme' })).toBeDisabled()
  })

  it('clearing the box clears the options', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.type(input(), 'dark')
    await options()
    await user.clear(input())
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('warns before replacing an existing theme', async () => {
    const user = userEvent.setup()
    renderDialog({ willReplaceTheme: true })
    expect(screen.queryByText(/Replaces your current theme/)).not.toBeInTheDocument()
    await user.type(input(), 'dark theme')
    await options()
    expect(screen.getByText(/Replaces your current theme/)).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDialog({ onClose })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('padToMinLines', () => {
  const json = LANGUAGES.find((l) => l.id === 'json')!

  it('leaves a long-enough sample untouched', () => {
    const code = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
    expect(padToMinLines(json, code)).toBe(code)
  })

  it('tops a short sample up to the minimum with more of the same language', () => {
    const padded = padToMinLines(json, '{\n  "a": 1\n}')
    expect(padded.split('\n').length).toBeGreaterThanOrEqual(MIN_PREVIEW_LINES)
    expect(padded.startsWith('{\n  "a": 1\n}\n')).toBe(true)
  })

  it('always reaches 20 lines for every real sample of every language', () => {
    for (const lang of LANGUAGES) {
      for (let seed = 0; seed < 30; seed++) {
        expect(padToMinLines(lang, lang.generate(seed)).split('\n').length, `${lang.id} seed ${seed}`).toBeGreaterThanOrEqual(MIN_PREVIEW_LINES)
      }
    }
  })
})
