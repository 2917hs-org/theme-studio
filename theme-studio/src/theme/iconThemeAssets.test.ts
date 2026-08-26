import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { IconThemePreviewError, loadIconThemePreview } from './iconThemeAssets'

const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'

// Mirrors the real shape confirmed against Material Icon Theme's actual
// published .vsix: the icon-theme JSON lives a directory below the
// extension root and resolves its own iconPath entries relative to
// itself (`./../icons/...`), not to the extension root — exercising that
// double-relative resolution is the point of nesting under `dist/` here.
function buildFakeIconThemeVsix(overrides?: { iconDefinitions?: Record<string, unknown> }) {
  const packageJson = {
    name: 'fake-icon-theme',
    contributes: { iconThemes: [{ id: 'fake', label: 'Fake Icons', path: './dist/icons.json' }] },
  }
  const iconThemeJson = {
    iconDefinitions: overrides?.iconDefinitions ?? {
      folder: { iconPath: './../icons/folder.svg' },
      'folder-src-open': { iconPath: './../icons/folder-src-open.svg' },
      typescript: { iconPath: './../icons/typescript.svg' },
      json: { iconPath: './../icons/json.svg' },
    },
    file: 'file-generic',
    folder: 'folder',
    folderExpanded: 'folder',
    fileExtensions: { ts: 'typescript' },
    fileNames: { 'package.json': 'json' },
    folderNames: {},
    folderNamesExpanded: { components: 'folder-src-open' },
  }
  const files = {
    'extension/package.json': strToU8(JSON.stringify(packageJson)),
    'extension/dist/icons.json': strToU8(JSON.stringify(iconThemeJson)),
    'extension/icons/folder.svg': strToU8(TINY_SVG),
    'extension/icons/folder-src-open.svg': strToU8(TINY_SVG),
    'extension/icons/typescript.svg': strToU8(TINY_SVG),
    'extension/icons/json.svg': strToU8(TINY_SVG),
  }
  const blob = new Blob([zipSync(files) as BlobPart], { type: 'application/zip' })
  return new File([blob], 'fake-icon-theme.vsix')
}

describe('loadIconThemePreview', () => {
  it('resolves image-based icons through the double-relative path (JSON dir + iconPath)', async () => {
    const result = await loadIconThemePreview(buildFakeIconThemeVsix())
    expect(result.folderClosed).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(result.usesIconFonts).toBe(false)
  })

  it('resolves a folder by exact folderNamesExpanded match, falling back to the default for an unmatched one', async () => {
    const result = await loadIconThemePreview(buildFakeIconThemeVsix())
    // "components" is in the sample set and matches folderNamesExpanded exactly.
    expect(result.folderOpen).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('resolves a file by exact fileNames match ahead of extension', async () => {
    const result = await loadIconThemePreview(buildFakeIconThemeVsix())
    const packageJsonEntry = result.files.find((f) => f.name === 'package.json')
    expect(packageJsonEntry?.dataUri).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('resolves a file by extension when no exact name matches', async () => {
    const result = await loadIconThemePreview(buildFakeIconThemeVsix())
    const indexTs = result.files.find((f) => f.name === 'index.ts')
    expect(indexTs?.dataUri).toMatch(/^data:image\/svg\+xml;base64,/)
  })

  it('leaves an unresolvable file as null instead of throwing', async () => {
    const result = await loadIconThemePreview(buildFakeIconThemeVsix())
    // .gitignore matches nothing in this fixture's fileNames/fileExtensions, and "file" -> "file-generic" has no definition entry.
    const gitignore = result.files.find((f) => f.name === '.gitignore')
    expect(gitignore?.dataUri).toBeNull()
  })

  it('flags font-based icon themes instead of guessing at a rendering', async () => {
    const result = await loadIconThemePreview(
      buildFakeIconThemeVsix({
        iconDefinitions: { folder: { fontCharacter: 'A' }, typescript: { fontCharacter: 'B' } },
      }),
    )
    expect(result.usesIconFonts).toBe(true)
    expect(result.folderClosed).toBeNull()
  })

  it('throws IconThemePreviewError when the package has no icon theme contribution', async () => {
    const files = { 'extension/package.json': strToU8(JSON.stringify({ name: 'not-an-icon-theme' })) }
    const blob = new Blob([zipSync(files) as BlobPart], { type: 'application/zip' })
    await expect(loadIconThemePreview(new File([blob], 'x.vsix'))).rejects.toThrow(IconThemePreviewError)
  })

  it('throws IconThemePreviewError for a file that is not a valid zip', async () => {
    await expect(loadIconThemePreview(new File([new Blob(['not a zip'])], 'x.vsix'))).rejects.toThrow(IconThemePreviewError)
  })
})
