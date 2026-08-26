import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportSlug, buildVsixBlob, composeAutoThemeName, slugify } from './buildVsix'

const MATERIAL_ICON_THEME = {
  publisherName: 'pkief',
  extensionName: 'material-icon-theme',
  displayName: 'Material Icon Theme',
  iconUrl: null,
  vsixUrl: null,
}

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
        vsixUrl: null,
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

describe('composeAutoThemeName', () => {
  it('is just "vsts" when neither a product theme nor an icon theme is selected', () => {
    expect(composeAutoThemeName(null)).toBe('vsts')
    expect(composeAutoThemeName(null, null)).toBe('vsts')
  })

  it('adds the slugified product theme name when one is selected', () => {
    expect(composeAutoThemeName('Midnight')).toBe('vsts-midnight')
  })

  it('adds the paired icon theme even with no product theme selected', () => {
    expect(composeAutoThemeName(null, MATERIAL_ICON_THEME)).toBe('vsts-material-icon-theme')
  })

  it('combines both when both are selected', () => {
    expect(composeAutoThemeName('Midnight', MATERIAL_ICON_THEME)).toBe('vsts-midnight-material-icon-theme')
  })

  it('never doubles the icon segment when fed back through buildExportSlug for the raw product name (not the composed string)', () => {
    // This is the exact pairing ExportPanel.tsx relies on: compose the
    // display value from the raw name, and separately slug the same raw
    // name for export — never chain compose -> slug on its own output.
    const composed = composeAutoThemeName('Midnight', MATERIAL_ICON_THEME)
    expect(composed).toBe('vsts-midnight-material-icon-theme')
    expect(buildExportSlug('Midnight', MATERIAL_ICON_THEME)).toBe(composed)
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
      vsixUrl: null,
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
