import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import {
  SHARE_LINK_SCHEMA_VERSION,
  buildShareLink,
  clearShareLinkParam,
  decodeShareLink,
  decodeShareUrl,
  encodeShareLink,
  readShareLinkParam,
  shareLinkToImportedTheme,
  type ShareLinkPayload,
} from './shareLink'

const PAYLOAD: Omit<ShareLinkPayload, 'schemaVersion'> = {
  mode: 'dark',
  themeName: 'My Theme',
  productThemeName: 'Tokyo Night',
  assignments: { dark: [['keyword', '#bb9af7']], light: [] },
  chrome: { dark: { background: '#1a1b26' }, light: {} },
  pairedIconTheme: null,
}

describe('encodeShareLink / decodeShareLink', () => {
  it('round-trips a payload exactly', () => {
    const encoded = encodeShareLink(PAYLOAD)
    const result = decodeShareLink(encoded)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload).toEqual({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION })
    }
  })

  it('reports malformed for garbage input', () => {
    expect(decodeShareLink('not-a-real-encoded-value!!!')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('reports malformed for an empty string', () => {
    expect(decodeShareLink('')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('reports malformed when required fields are missing', () => {
    const encoded = encodeShareLink({ ...PAYLOAD, themeName: undefined as unknown as string })
    expect(decodeShareLink(encoded)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('reports old-version for a payload from a different schema version', () => {
    const raw = JSON.stringify({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION + 1 })
    const encoded = compressToEncodedURIComponent(raw)
    expect(decodeShareLink(encoded)).toEqual({ ok: false, reason: 'old-version' })
  })
})

describe('buildShareLink / readShareLinkParam / clearShareLinkParam', () => {
  it('produces a URL whose ?t= param decodes back to the same payload', () => {
    const url = buildShareLink(PAYLOAD)
    expect(url.startsWith(window.location.origin)).toBe(true)
    const param = readShareLinkParam(url)
    expect(param).not.toBeNull()
    const result = decodeShareLink(param!)
    expect(result.ok).toBe(true)
  })

  it('readShareLinkParam returns null when there is no ?t=', () => {
    expect(readShareLinkParam('https://example.com/')).toBeNull()
  })

  it('clearShareLinkParam removes ?t= from the address bar without touching other params', () => {
    window.history.replaceState(null, '', '/?t=abc123&foo=bar')
    clearShareLinkParam()
    expect(window.location.search).toBe('?foo=bar')
  })

  it('clearShareLinkParam is a no-op when there is no ?t=', () => {
    window.history.replaceState(null, '', '/?foo=bar')
    clearShareLinkParam()
    expect(window.location.search).toBe('?foo=bar')
  })
})

describe('shareLinkToImportedTheme', () => {
  it('carries over the source theme name, preferring productThemeName', () => {
    const theme = shareLinkToImportedTheme({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION })
    expect(theme.name).toBe('Tokyo Night')
  })

  it('falls back to themeName when there is no productThemeName', () => {
    const theme = shareLinkToImportedTheme({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION, productThemeName: null })
    expect(theme.name).toBe('My Theme')
  })

  it('only includes a mode that has assignments or a chrome override', () => {
    const theme = shareLinkToImportedTheme({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION })
    expect(theme.variants).toHaveLength(1)
    expect(theme.variants[0].mode).toBe('dark')
    expect(theme.variants[0].assignments.get('keyword')).toBe('#bb9af7')
  })

  it('falls back to a single empty variant in the payload mode when nothing was colored', () => {
    const theme = shareLinkToImportedTheme({
      schemaVersion: SHARE_LINK_SCHEMA_VERSION,
      mode: 'light',
      themeName: 'Blank',
      productThemeName: null,
      assignments: {},
      chrome: {},
      pairedIconTheme: null,
    })
    expect(theme.variants).toEqual([{ mode: 'light', chrome: {}, assignments: new Map() }])
  })
})

describe('decodeShareUrl', () => {
  it('decodes a full URL the same way the address bar bootstrap does', () => {
    const url = buildShareLink(PAYLOAD)
    const result = decodeShareUrl(url)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.themeName).toBe('My Theme')
  })

  it('reports malformed for a URL with no ?t= at all — e.g. a Gallery entry with a bad link', () => {
    expect(decodeShareUrl('https://example.com/')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('reports old-version for a URL whose payload is from a different schema version', () => {
    const raw = JSON.stringify({ ...PAYLOAD, schemaVersion: SHARE_LINK_SCHEMA_VERSION + 1 })
    const encoded = compressToEncodedURIComponent(raw)
    expect(decodeShareUrl(`https://example.com/?t=${encoded}`)).toEqual({ ok: false, reason: 'old-version' })
  })
})
