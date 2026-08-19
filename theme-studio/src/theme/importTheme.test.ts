import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { ImportError, importThemeFile } from './importTheme'

function jsonFile(name: string, data: unknown): File {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

const SAMPLE_THEME = {
  name: 'Sample Theme',
  type: 'dark',
  colors: {
    'editor.background': '#101010',
    'editor.foreground': '#eeeeee',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#888888' } },
    { scope: ['keyword', 'storage'], settings: { foreground: '#ff00ff' } },
    { scope: 'string.quoted, string.template', settings: { foreground: '#00ff00' } },
    { settings: { foreground: '#eeeeee' } }, // root default entry, no scope — should be skipped
    { scope: 'invalid.nothing' }, // no settings.foreground — should be skipped
  ],
}

describe('importThemeFile — plain JSON', () => {
  it('parses name, mode, chrome, and per-scope assignments', async () => {
    const theme = await importThemeFile(jsonFile('sample.json', SAMPLE_THEME))
    expect(theme.name).toBe('Sample Theme')
    expect(theme.variants).toHaveLength(1)
    const [variant] = theme.variants
    expect(variant.mode).toBe('dark')
    expect(variant.chrome).toEqual({ background: '#101010', foreground: '#eeeeee' })
    expect(variant.assignments.get('comment')).toBe('#888888')
    expect(variant.assignments.get('keyword')).toBe('#ff00ff')
    expect(variant.assignments.get('storage')).toBe('#ff00ff')
    expect(variant.assignments.get('string.quoted')).toBe('#00ff00')
    expect(variant.assignments.get('string.template')).toBe('#00ff00')
    expect(variant.assignments.size).toBe(5)
  })

  it('falls back to the filename (minus extension) when the theme has no name', async () => {
    const theme = await importThemeFile(jsonFile('My Cool Theme.json', { ...SAMPLE_THEME, name: undefined }))
    expect(theme.name).toBe('My Cool Theme')
  })

  it('infers light mode from a light background when "type" is missing', async () => {
    const theme = await importThemeFile(
      jsonFile('untyped.json', {
        colors: { 'editor.background': '#ffffff', 'editor.foreground': '#000000' },
        tokenColors: [{ scope: 'comment', settings: { foreground: '#777777' } }],
      }),
    )
    expect(theme.variants[0].mode).toBe('light')
  })

  it('drops the alpha channel from 8-digit hex colors', async () => {
    const theme = await importThemeFile(
      jsonFile('alpha.json', {
        type: 'dark',
        colors: { 'editor.background': '#10101080' },
        tokenColors: [{ scope: 'comment', settings: { foreground: '#88888880' } }],
      }),
    )
    expect(theme.variants[0].chrome.background).toBe('#101010')
    expect(theme.variants[0].assignments.get('comment')).toBe('#888888')
  })

  it('rejects a file with no colors or tokenColors', async () => {
    await expect(importThemeFile(jsonFile('not-a-theme.json', { foo: 'bar' }))).rejects.toThrow(ImportError)
  })

  it('rejects invalid JSON', async () => {
    const file = new File(['{ not json'], 'broken.json', { type: 'application/json' })
    await expect(importThemeFile(file)).rejects.toThrow(ImportError)
  })
})

// Probing ~300 real Marketplace themes through this app's import path found
// roughly 45% failed outright — nearly all because their theme JSON is
// JSONC (trailing commas, `//`/`/* */` comments), which VS Code's own
// loader tolerates but strict JSON.parse rejects. These lock that fix in.
describe('importThemeFile — JSONC leniency', () => {
  it('tolerates a trailing comma', async () => {
    const raw = `{
      "type": "dark",
      "colors": { "editor.background": "#101010", },
      "tokenColors": [
        { "scope": "keyword", "settings": { "foreground": "#ff00ff" } },
      ],
    }`
    const file = new File([raw], 'trailing-comma.json', { type: 'application/json' })
    const theme = await importThemeFile(file)
    expect(theme.variants[0].assignments.get('keyword')).toBe('#ff00ff')
  })

  it('tolerates line and block comments', async () => {
    const raw = `{
      // a dark theme
      "type": "dark",
      "colors": { "editor.background": "#101010" },
      "tokenColors": [
        /* keywords */
        { "scope": "keyword", "settings": { "foreground": "#ff00ff" } }
      ]
    }`
    const file = new File([raw], 'commented.json', { type: 'application/json' })
    const theme = await importThemeFile(file)
    expect(theme.variants[0].assignments.get('keyword')).toBe('#ff00ff')
  })

  it('tolerates a leading byte-order mark', async () => {
    const raw = '﻿' + JSON.stringify(SAMPLE_THEME)
    const file = new File([raw], 'bom.json', { type: 'application/json' })
    const theme = await importThemeFile(file)
    expect(theme.name).toBe('Sample Theme')
  })

  it('still rejects content that is not JSON or JSONC at all', async () => {
    const file = new File(['not json at all, just prose'], 'garbage.json', { type: 'application/json' })
    await expect(importThemeFile(file)).rejects.toThrow(ImportError)
  })
})

describe('importThemeFile — VSIX', () => {
  function buildVsix(themes: Array<{ fileName: string; label: string; uiTheme: string; json: unknown }>): File {
    const files: Record<string, Uint8Array> = {
      'extension/package.json': strToU8(
        JSON.stringify({
          name: 'my-vsix-theme',
          displayName: 'My VSIX Theme',
          contributes: {
            themes: themes.map((t) => ({ label: t.label, uiTheme: t.uiTheme, path: `./themes/${t.fileName}` })),
          },
        }),
      ),
    }
    for (const t of themes) {
      files[`extension/themes/${t.fileName}`] = strToU8(JSON.stringify(t.json))
    }
    const zipped = zipSync(files)
    return new File([zipped as BlobPart], 'my-theme.vsix', { type: 'application/zip' })
  }

  it('extracts both dark and light variants from package.json contributions', async () => {
    const file = buildVsix([
      { fileName: 'dark.json', label: 'My VSIX Theme Dark', uiTheme: 'vs-dark', json: { ...SAMPLE_THEME, type: 'dark' } },
      {
        fileName: 'light.json',
        label: 'My VSIX Theme Light',
        uiTheme: 'vs',
        json: {
          type: 'light',
          colors: { 'editor.background': '#ffffff' },
          tokenColors: [{ scope: 'string', settings: { foreground: '#006600' } }],
        },
      },
    ])
    const theme = await importThemeFile(file)
    expect(theme.name).toBe('My VSIX Theme')
    expect(theme.variants.map((v) => v.mode).sort()).toEqual(['dark', 'light'])
    const dark = theme.variants.find((v) => v.mode === 'dark')!
    expect(dark.assignments.get('comment')).toBe('#888888')
    const light = theme.variants.find((v) => v.mode === 'light')!
    expect(light.assignments.get('string')).toBe('#006600')
  })

  it('rejects a zip with no extension/package.json', async () => {
    const zipped = zipSync({ 'readme.txt': strToU8('hello') })
    const file = new File([zipped as BlobPart], 'not-a-theme.vsix', { type: 'application/zip' })
    await expect(importThemeFile(file)).rejects.toThrow(ImportError)
  })

  it('rejects a package.json with no theme contributions', async () => {
    const zipped = zipSync({
      'extension/package.json': strToU8(JSON.stringify({ name: 'not-a-theme', contributes: {} })),
    })
    const file = new File([zipped as BlobPart], 'not-a-theme.vsix', { type: 'application/zip' })
    await expect(importThemeFile(file)).rejects.toThrow(ImportError)
  })

  it('is detected by zip magic bytes even without a .vsix extension', async () => {
    const file = buildVsix([{ fileName: 'dark.json', label: 'Renamed', uiTheme: 'vs-dark', json: SAMPLE_THEME }])
    const renamed = new File([await file.arrayBuffer()], 'my-theme.zip', { type: 'application/zip' })
    const theme = await importThemeFile(renamed)
    expect(theme.variants).toHaveLength(1)
  })

  it('skips a legacy .tmTheme (plist/XML) variant instead of crashing the whole import', async () => {
    // Real-world case: some published themes (e.g. "Super One Dark Theme")
    // still ship a .tmTheme XML file even though package.json correctly
    // declares a theme contribution. jsonc-parser reads the leading `<` as a
    // bare JSON value, so parseThemeObject — not parseLenientJson — is what
    // rejects it; that used to happen outside the per-variant try/catch and
    // crashed the import with a misleading "Not a valid VS Code theme file."
    const zipped = zipSync({
      'extension/package.json': strToU8(
        JSON.stringify({
          name: 'tm-theme',
          displayName: 'TM Theme',
          contributes: { themes: [{ label: 'TM Theme', uiTheme: 'vs-dark', path: './themes/dark.tmTheme' }] },
        }),
      ),
      'extension/themes/dark.tmTheme': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">\n<plist version="1.0"><dict/></plist>',
      ),
    })
    const file = new File([zipped as BlobPart], 'tm-theme.vsix', { type: 'application/zip' })
    await expect(importThemeFile(file)).rejects.toThrow(ImportError)
    await expect(importThemeFile(file)).rejects.toThrow('Could not read any theme files inside this .vsix.')
  })

  it('tolerates JSONC (trailing commas, comments) in a bundled theme file — the real-world common case', async () => {
    const rawThemeJsonc = `{
      // hand-edited theme
      "type": "dark",
      "colors": { "editor.background": "#101010", },
      "tokenColors": [
        { "scope": "keyword", "settings": { "foreground": "#ff00ff" }, },
      ],
    }`
    const zipped = zipSync({
      'extension/package.json': strToU8(
        JSON.stringify({
          name: 'jsonc-theme',
          displayName: 'JSONC Theme',
          contributes: { themes: [{ label: 'JSONC Theme', uiTheme: 'vs-dark', path: './themes/dark.json' }] },
        }),
      ),
      'extension/themes/dark.json': strToU8(rawThemeJsonc),
    })
    const file = new File([zipped as BlobPart], 'jsonc-theme.vsix', { type: 'application/zip' })
    const theme = await importThemeFile(file)
    expect(theme.variants[0].assignments.get('keyword')).toBe('#ff00ff')
  })
})
