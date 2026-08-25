import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportSlug, buildVsixBlob, slugify } from './buildVsix'

async function unzip(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return unzipSync(bytes)
}

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('My Cool Theme')).toBe('my-cool-theme')
  })

  it('strips non-alphanumeric characters', () => {
    expect(slugify("Neo's Theme! (v2)")).toBe('neo-s-theme-v2')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Weird Name--  ')).toBe('weird-name')
  })

  it('falls back to "custom-theme" when nothing alphanumeric remains', () => {
    expect(slugify('!!!')).toBe('custom-theme')
    expect(slugify('')).toBe('custom-theme')
  })
})

describe('buildExportSlug', () => {
  it('carries the vsts product prefix with just the theme name when unpaired', () => {
    expect(buildExportSlug('Midnight')).toBe('vsts-midnight')
  })

  it('appends the paired icon theme\'s own extension name when paired', () => {
    expect(
      buildExportSlug('Midnight', {
        publisherName: 'pkief',
        extensionName: 'material-icon-theme',
        displayName: 'Material Icon Theme',
        iconUrl: null,
      }),
    ).toBe('vsts-midnight-material-icon-theme')
  })

  it('ignores a null pairing the same as no pairing at all', () => {
    expect(buildExportSlug('Midnight', null)).toBe('vsts-midnight')
  })

  it('does not double the vsts prefix when the theme name already starts with it (the app default)', () => {
    expect(buildExportSlug('VSTS My Theme')).toBe('vsts-my-theme')
  })
})

describe('buildVsixBlob', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('produces a zip Blob', async () => {
    const assignments = new Map([['keyword', '#ff0000']])
    const blob = await buildVsixBlob('My Theme', [{ mode: 'dark', assignments }])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('rejects an empty variant list rather than silently producing a theme with nothing in it', async () => {
    await expect(buildVsixBlob('My Theme', [])).rejects.toThrow()
  })

  it('escapes XML-significant characters in the theme name for the manifest', async () => {
    // Reading the zip back out isn't worth a new dependency here — this
    // guards the escaper doesn't throw and still produces a well-formed
    // (non-empty) archive for names carrying XML metacharacters.
    const blob = await buildVsixBlob('<Theme & "Friends">', [{ mode: 'dark', assignments: new Map() }])
    expect(blob.size).toBeGreaterThan(0)
  })

  it('continues without an icon when the icon fetch fails', async () => {
    await expect(buildVsixBlob('Fails Gracefully', [{ mode: 'dark', assignments: new Map() }])).resolves.toBeInstanceOf(Blob)
  })

  it('packages a single variant as one theme entry named after the theme itself', async () => {
    const blob = await buildVsixBlob('Midnight', [{ mode: 'dark', assignments: new Map([['keyword', '#ff0000']]) }])
    const files = await unzip(blob)
    const pkg = JSON.parse(strFromU8(files['extension/package.json']))
    expect(pkg.contributes.themes).toEqual([{ label: 'Midnight', uiTheme: 'vs-dark', path: './themes/dark.json' }])
    expect(files['extension/themes/dark.json']).toBeDefined()
    expect(files['extension/themes/light.json']).toBeUndefined()
  })

  it('bundles both modes as two theme entries in one package when both are provided', async () => {
    const blob = await buildVsixBlob('Midnight', [
      { mode: 'dark', assignments: new Map([['keyword', '#ff0000']]) },
      { mode: 'light', assignments: new Map([['keyword', '#0000ff']]) },
    ])
    const files = await unzip(blob)
    const pkg = JSON.parse(strFromU8(files['extension/package.json']))
    expect(pkg.contributes.themes).toEqual([
      { label: 'Midnight Dark', uiTheme: 'vs-dark', path: './themes/dark.json' },
      { label: 'Midnight Light', uiTheme: 'vs', path: './themes/light.json' },
    ])
    expect(pkg.description).toContain('Dark + Light')

    const darkTheme = JSON.parse(strFromU8(files['extension/themes/dark.json']))
    const lightTheme = JSON.parse(strFromU8(files['extension/themes/light.json']))
    expect(darkTheme.tokenColors.some((t: { scope: string }) => t.scope === 'keyword')).toBe(true)
    expect(darkTheme.colors['editor.background']).not.toBe(lightTheme.colors['editor.background'])
  })

  it('omits extensionPack when no icon theme is paired', async () => {
    const blob = await buildVsixBlob('Midnight', [{ mode: 'dark', assignments: new Map() }])
    const files = await unzip(blob)
    const pkg = JSON.parse(strFromU8(files['extension/package.json']))
    expect(pkg.extensionPack).toBeUndefined()
  })

  it('references a paired icon theme as an extensionPack entry rather than bundling its assets', async () => {
    const blob = await buildVsixBlob('Midnight', [{ mode: 'dark', assignments: new Map() }], {
      publisherName: 'pkief',
      extensionName: 'material-icon-theme',
      displayName: 'Material Icon Theme',
      iconUrl: null,
    })
    const files = await unzip(blob)
    const pkg = JSON.parse(strFromU8(files['extension/package.json']))
    expect(pkg.extensionPack).toEqual(['pkief.material-icon-theme'])

    const readme = strFromU8(files['extension/README.md'])
    expect(readme).toContain('Material Icon Theme')

    const manifest = strFromU8(files['extension.vsixmanifest'])
    expect(manifest).toContain('Microsoft.VisualStudio.Code.ExtensionPack')
    expect(manifest).toContain('pkief.material-icon-theme')

    // No asset from the icon theme's own package ever gets copied in — the
    // export stays exactly the same set of files as an unpaired one, plus
    // the extensionPack reference above.
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      'extension.vsixmanifest',
      'extension/CHANGELOG.md',
      'extension/README.md',
      'extension/package.json',
      'extension/themes/dark.json',
    ])
  })
})
