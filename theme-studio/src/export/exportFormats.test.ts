import { describe, expect, it } from 'vitest'
import { buildSingleFileExport, EXPORT_FORMATS, hasEnoughForSingleFileExport, isSingleFileFormat } from './exportFormats'

describe('isSingleFileFormat', () => {
  it('is false only for vscode', () => {
    expect(isSingleFileFormat('vscode')).toBe(false)
    expect(isSingleFileFormat('windows-terminal')).toBe(true)
    expect(isSingleFileFormat('iterm2')).toBe(true)
    expect(isSingleFileFormat('zed')).toBe(true)
  })
})

describe('EXPORT_FORMATS', () => {
  it('lists vscode first', () => {
    expect(EXPORT_FORMATS[0].id).toBe('vscode')
  })
})

describe('hasEnoughForSingleFileExport', () => {
  it('is false for an empty theme', () => {
    expect(hasEnoughForSingleFileExport('dark', new Map(), {})).toBe(false)
  })

  it('is true once enough accent fields are colored', () => {
    const assignments = new Map([
      ['keyword', '#111111'],
      ['string', '#222222'],
      ['entity.name.function', '#333333'],
    ])
    expect(hasEnoughForSingleFileExport('dark', assignments, {})).toBe(true)
  })
})

describe('buildSingleFileExport', () => {
  const assignments = new Map([
    ['keyword', '#bb9af7'],
    ['string', '#9ece6a'],
    ['entity.name.function', '#7aa2f7'],
  ])

  it('produces a distinct, extension-appropriate filename per format', () => {
    expect(buildSingleFileExport('windows-terminal', 'My Theme', 'dark', assignments, {}).filename).toBe(
      'my-theme.windowsterminal.json',
    )
    expect(buildSingleFileExport('iterm2', 'My Theme', 'dark', assignments, {}).filename).toBe('my-theme.itermcolors')
    expect(buildSingleFileExport('zed', 'My Theme', 'dark', assignments, {}).filename).toBe('my-theme-zed-theme.json')
  })

  it('windows-terminal and zed content is valid JSON', () => {
    expect(() => JSON.parse(buildSingleFileExport('windows-terminal', 'T', 'dark', assignments, {}).content)).not.toThrow()
    expect(() => JSON.parse(buildSingleFileExport('zed', 'T', 'dark', assignments, {}).content)).not.toThrow()
  })

  it('iterm2 content is plist XML, not JSON', () => {
    const { content } = buildSingleFileExport('iterm2', 'T', 'dark', assignments, {})
    expect(content).toContain('<plist version="1.0">')
    expect(() => JSON.parse(content)).toThrow()
  })

  it('reflects a chrome override in the exported background', () => {
    const { content } = buildSingleFileExport('windows-terminal', 'T', 'dark', assignments, { background: '#123456' })
    expect(JSON.parse(content).background).toBe('#123456')
  })
})
