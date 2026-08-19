import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketplaceError, fetchMarketplaceVsix, searchMarketplaceThemes } from './searchMarketplace'

function galleryResponse(extensions: unknown[]) {
  return { results: [{ extensions }] }
}

const SAMPLE_EXTENSION = {
  publisher: { publisherName: 'dracula-theme', displayName: 'Dracula Theme' },
  extensionName: 'theme-dracula',
  displayName: 'Dracula Theme Official',
  shortDescription: 'A dark theme.',
  versions: [
    {
      version: '2.25.1',
      files: [
        { assetType: 'Microsoft.VisualStudio.Services.Icons.Default', source: 'https://cdn.example/icon.png' },
        { assetType: 'Microsoft.VisualStudio.Services.VSIXPackage', source: 'https://cdn.example/dracula.vsix' },
      ],
    },
  ],
  statistics: [{ statisticName: 'install', value: 1234567 }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchMarketplaceThemes', () => {
  it('parses a well-formed response into results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => galleryResponse([SAMPLE_EXTENSION]) })),
    )
    const results = await searchMarketplaceThemes('dracula')
    expect(results).toEqual([
      {
        publisherName: 'dracula-theme',
        publisherDisplayName: 'Dracula Theme',
        extensionName: 'theme-dracula',
        displayName: 'Dracula Theme Official',
        shortDescription: 'A dark theme.',
        iconUrl: 'https://cdn.example/icon.png',
        installCount: 1234567,
        version: '2.25.1',
        vsixUrl: 'https://cdn.example/dracula.vsix',
      },
    ])
  })

  it('skips extensions with no downloadable VSIX asset', async () => {
    const noVsix = { ...SAMPLE_EXTENSION, versions: [{ version: '1.0.0', files: [] }] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => galleryResponse([noVsix]) })),
    )
    const results = await searchMarketplaceThemes('dracula')
    expect(results).toEqual([])
  })

  it('tolerates missing icon and statistics', async () => {
    const minimal = {
      publisher: { publisherName: 'p', displayName: 'P' },
      extensionName: 'e',
      displayName: 'E',
      versions: [
        { version: '1.0.0', files: [{ assetType: 'Microsoft.VisualStudio.Services.VSIXPackage', source: 'https://cdn.example/e.vsix' }] },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => galleryResponse([minimal]) })),
    )
    const [result] = await searchMarketplaceThemes('e')
    expect(result.iconUrl).toBeNull()
    expect(result.installCount).toBeNull()
    expect(result.shortDescription).toBeNull()
  })

  it('throws MarketplaceError when the request fails outright', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(searchMarketplaceThemes('x')).rejects.toThrow(MarketplaceError)
  })

  it('throws MarketplaceError on a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    )
    await expect(searchMarketplaceThemes('x')).rejects.toThrow(MarketplaceError)
  })

  it('restricts the query to extensions tagged as color themes, excluding icon-only themes', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => galleryResponse([SAMPLE_EXTENSION]),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await searchMarketplaceThemes('nomo dark')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.filters[0].criteria).toContainEqual({ filterType: 1, value: 'color-theme' })
  })

  it('throws MarketplaceError when the response is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error('bad json')
        },
      })),
    )
    await expect(searchMarketplaceThemes('x')).rejects.toThrow(MarketplaceError)
  })
})

describe('fetchMarketplaceVsix', () => {
  const RESULT = {
    publisherName: 'dracula-theme',
    publisherDisplayName: 'Dracula Theme',
    extensionName: 'theme-dracula',
    displayName: 'Dracula Theme Official',
    shortDescription: null,
    iconUrl: null,
    installCount: null,
    version: '2.25.1',
    vsixUrl: 'https://cdn.example/dracula.vsix',
  }

  it('downloads and wraps the VSIX as a named File', async () => {
    const blob = new Blob(['zip-bytes'], { type: 'application/zip' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, blob: async () => blob })),
    )
    const file = await fetchMarketplaceVsix(RESULT)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('dracula-theme.theme-dracula-2.25.1.vsix')
  })

  it('throws MarketplaceError on a failed download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    )
    await expect(fetchMarketplaceVsix(RESULT)).rejects.toThrow(MarketplaceError)
  })

  it('throws MarketplaceError when the network request itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(fetchMarketplaceVsix(RESULT)).rejects.toThrow(MarketplaceError)
  })
})
