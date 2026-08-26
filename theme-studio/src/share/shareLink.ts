import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';
import type { ImportedTheme, ImportedVariant } from '../theme/importTheme';

const SHARE_LINK_PARAM = 't';

// Bumped whenever this shape changes in a way older code can't read —
// decodeShareLink rejects anything else as `old-version` rather than
// guessing at a migration, so a link never silently misapplies stale data.
export const SHARE_LINK_SCHEMA_VERSION = 1;

export interface ShareLinkPayload {
  schemaVersion: number;
  mode: ThemeMode;
  themeName: string;
  /** The preset/import/Marketplace theme this was built from, if any — carried along so a fork keeps its attribution (mirrors AssignmentsContext's `productThemeName`). */
  productThemeName: string | null;
  assignments: Partial<Record<ThemeMode, Array<[string, string]>>>;
  chrome: Partial<Record<ThemeMode, ChromeOverride>>;
  pairedIconTheme: PairedIconTheme | null;
}

export type DecodeShareLinkResult =
  | { ok: true; payload: ShareLinkPayload }
  | { ok: false; reason: 'malformed' | 'old-version' };

function isValidPayload(v: unknown): v is ShareLinkPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.schemaVersion === 'number' &&
    (p.mode === 'dark' || p.mode === 'light') &&
    typeof p.themeName === 'string' &&
    typeof p.assignments === 'object' &&
    p.assignments !== null &&
    typeof p.chrome === 'object' &&
    p.chrome !== null
  );
}

/** Reads the `?t=` param from a URL (defaults to the current page's), or null if absent. */
export function readShareLinkParam(url: string | URL = window.location.href): string | null {
  return new URL(url).searchParams.get(SHARE_LINK_PARAM);
}

/** Strips `?t=` from the address bar without a navigation/reload — applying a shared link is a one-time action, not something a refresh or Back should redo. */
export function clearShareLinkParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SHARE_LINK_PARAM)) return;
  url.searchParams.delete(SHARE_LINK_PARAM);
  window.history.replaceState(null, '', url);
}

export function encodeShareLink(payload: Omit<ShareLinkPayload, 'schemaVersion'>): string {
  const full: ShareLinkPayload = { ...payload, schemaVersion: SHARE_LINK_SCHEMA_VERSION };
  return compressToEncodedURIComponent(JSON.stringify(full));
}

/** Never throws — a malformed, truncated, or tampered `?t=` value is always reported as a typed result instead. */
export function decodeShareLink(encoded: string): DecodeShareLinkResult {
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(encoded);
  } catch {
    json = null;
  }
  if (!json) return { ok: false, reason: 'malformed' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!isValidPayload(parsed)) return { ok: false, reason: 'malformed' };
  if (parsed.schemaVersion !== SHARE_LINK_SCHEMA_VERSION) return { ok: false, reason: 'old-version' };
  return { ok: true, payload: parsed };
}

/** The shareable URL for `payload` — same origin+base the app is actually running on (GitHub Pages subpath, custom domain, or localhost), consistent with SharePanel's other share links. */
export function buildShareLink(payload: Omit<ShareLinkPayload, 'schemaVersion'>): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}?${SHARE_LINK_PARAM}=${encodeShareLink(payload)}`;
}

/**
 * Converts a decoded share-link payload into the same `ImportedTheme` shape
 * the upload/Marketplace import flow produces, so hydrating a link can reuse
 * `AssignmentsContext.importTheme` instead of a second, parallel "replace
 * everything" code path. A mode with no colored scopes and no chrome
 * override contributes nothing, so it's dropped here the same way
 * ExportPanel decides which modes are actually "real" for export — a share
 * link only ever describes what the sender had actually colored.
 */
export function shareLinkToImportedTheme(payload: ShareLinkPayload): ImportedTheme {
  const variants: ImportedVariant[] = (['dark', 'light'] as const)
    .map((m): ImportedVariant => ({
      mode: m,
      chrome: payload.chrome[m] ?? {},
      assignments: new Map(payload.assignments[m] ?? []),
    }))
    .filter((v) => v.assignments.size > 0 || Boolean(v.chrome.background || v.chrome.foreground));

  return {
    name: payload.productThemeName ?? payload.themeName,
    variants: variants.length > 0 ? variants : [{ mode: payload.mode, chrome: {}, assignments: new Map() }],
  };
}
