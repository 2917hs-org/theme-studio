import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssignmentsProvider } from '../store/AssignmentsContext'
import { useAssignments } from '../store/useAssignments'
import { decodeShareUrl } from '../share/shareLink'
import { SharePanel } from './SharePanel'

// A thin consumer so a test can color a token and name the theme before
// SharePanel ever reads context — mirrors ImportThemeDialog.test.tsx's
// SeedButton for the same reason (some other panel always does this in
// real usage).
function Seed({ name }: { name?: string }) {
  const { setColor, setThemeName } = useAssignments()
  return (
    <button
      onClick={() => {
        setColor('keyword', '#bb9af7', 'dark')
        if (name) setThemeName(name)
      }}
    >
      Seed
    </button>
  )
}

function setup(name?: string) {
  render(
    <AssignmentsProvider>
      <Seed name={name} />
      <SharePanel />
    </AssignmentsProvider>,
  )
}

function hrefFor(label: string): string {
  return screen.getByRole('link', { name: `Share on ${label}` }).getAttribute('href')!
}

describe('SharePanel — the two share mechanisms', () => {
  it('labels a plain link and posting to social as two distinct groups', () => {
    setup()
    expect(screen.getByText('Share a link')).toBeInTheDocument()
    expect(screen.getByText('Post to social')).toBeInTheDocument()
  })

  it('every social button already points at a real theme link, even before anything is colored', () => {
    setup()
    for (const label of ['LinkedIn', 'X', 'Reddit', 'Hacker News']) {
      expect(hrefFor(label)).toContain('%3Ft%3D') // encoded "?t="
    }
  })
})

describe('SharePanel — once something is colored', () => {
  it('points X, Reddit, and Hacker News at the actual theme link, with the theme name in the post copy', async () => {
    const user = userEvent.setup()
    setup('Midnight Coder')
    await user.click(screen.getByRole('button', { name: 'Seed' }))

    for (const label of ['X', 'Reddit', 'Hacker News']) {
      const href = hrefFor(label)
      expect(href).toContain('%3Ft%3D')
      expect(decodeURIComponent(href)).toContain('Midnight Coder')
    }
  })

  it('the social links all resolve to the exact same theme "Copy link" would produce', async () => {
    const user = userEvent.setup()
    setup('Midnight Coder')
    await user.click(screen.getByRole('button', { name: 'Seed' }))

    const xHref = hrefFor('X')
    const embeddedUrl = new URL(xHref).searchParams.get('url')!
    const result = decodeShareUrl(embeddedUrl)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.themeName).toBe('Midnight Coder')
      expect(result.payload.assignments.dark).toEqual([['keyword', '#bb9af7']])
    }
  })

  it('LinkedIn still gets the theme link even though it has no text param to customize', async () => {
    const user = userEvent.setup()
    setup('Midnight Coder')
    await user.click(screen.getByRole('button', { name: 'Seed' }))

    expect(hrefFor('LinkedIn')).toContain('%3Ft%3D')
  })
})
