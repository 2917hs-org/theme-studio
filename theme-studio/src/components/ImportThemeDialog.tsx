import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useAssignments } from '../store/useAssignments';
import { importThemeFile, ImportError, type ImportedTheme } from '../theme/importTheme';
import { PRESET_SCOPES } from '../theme/presets';
import type { LanguageDef } from '../data/languages';
import {
  fetchMarketplaceVsix,
  searchMarketplaceThemes,
  searchMarketplaceIconThemes,
  marketplaceItemUrl,
  MarketplaceError,
  type MarketplaceThemeResult,
  type MarketplaceIconThemeResult,
  type PairedIconTheme,
} from '../marketplace/searchMarketplace';
import { loadIconThemePreview, IconThemePreviewError, type IconThemePreviewAssets } from '../theme/iconThemeAssets';
import { baselineColorsFor } from '../theme/baseline';
import { track } from '../analytics/track';
import { ConfirmDialog } from './ConfirmDialog';
import { ThemePreview } from './ThemePreview';
import { IconThemeExplorerPreview } from './IconThemeExplorerPreview';
import { UploadIcon, SearchIcon, CloseIcon, FolderIcon } from './icons';

export type ImportTab = 'upload' | 'search' | 'icon-theme';

/** Where a parsed theme came from — distinguishes the `theme_imported` vs `marketplace_theme_forked` analytics events fired once it actually lands (see finishImport). */
type ImportSource = 'upload' | 'marketplace';

interface ImportThemeDialogProps {
  onClose: () => void;
  /** Reports a human-readable success message once an import lands, so the caller can surface it (e.g. as a toast). */
  onImported: (message: string) => void;
  /** Which tab is active when the dialog opens — lets each entry-point button land directly on the tab it promised. */
  initialTab?: ImportTab;
  /** The app's current sample — reused so a Marketplace theme previews against code you're already looking at, rather than a disconnected snippet. */
  language: LanguageDef;
  code: string;
}

const SEARCH_DEBOUNCE_MS = 400;
// The Marketplace search API only returns name/description/install-count —
// no colors — so a real preview means downloading each result's .vsix, same
// as an actual import. Capped concurrency keeps a page of results from
// firing a dozen-plus downloads all at once.
const PREVIEW_CONCURRENCY = 3;
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function resultKey(r: MarketplaceThemeResult): string {
  return `${r.publisherName}.${r.extensionName}`;
}

function iconResultKey(r: MarketplaceIconThemeResult): string {
  return `${r.publisherName}.${r.extensionName}`;
}

function formatInstallCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ImportThemeDialog({ onClose, onImported, initialTab = 'upload', language, code }: ImportThemeDialogProps) {
  const { assignmentsFor, chromeFor, importTheme, pairedIconTheme, setPairedIconTheme, mode, chrome } = useAssignments();
  const [tab, setTab] = useState<ImportTab>(initialTab);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Shared across both color-theme tabs — an import that would overwrite
  // existing color work waits for confirmation regardless of where it came
  // from. Icon-theme pairing never touches assignments, so it has no
  // equivalent — see handlePairIconTheme below. `closeAfter` rides along so
  // the confirm dialog (deferred by a render or more) still closes/keeps
  // open exactly as the original action intended.
  const [pendingImport, setPendingImport] = useState<{ theme: ImportedTheme; closeAfter: boolean; source: ImportSource } | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketplaceThemeResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every new search (and on clear) so a slow, superseded request
  // can't overwrite what a later one already rendered.
  const searchRequestIdRef = useRef(0);

  // Full parsed theme per result, keyed by extension — lives in a ref (not
  // state) since entries trickle in one at a time as downloads finish;
  // `previewTick` is the only piece of state, just to force a re-render when
  // the ref changes. Persists across searches so re-finding an
  // already-fetched extension doesn't re-download it. The same cache backs
  // both the quick-glance swatch in each row and the full code preview pane.
  const themeCacheRef = useRef<Map<string, ImportedTheme | 'failed'>>(new Map());
  const [, setPreviewTick] = useState(0);

  // Hover previews instantly; a click "pins" one so it survives moving the
  // mouse toward the preview pane or the Use button. Hover always wins while
  // active, falling back to whatever's pinned once the mouse leaves the list.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const activePreviewKey = hoveredKey ?? pinnedKey;

  // --- Icon-theme tab: entirely separate state, since it searches a
  // different endpoint filter, previews real icon assets instead of parsed
  // color themes, and never touches color assignments at all (no
  // hasExistingWork/pendingImport equivalent — pairing is a reference, not
  // a replace).
  const [iconQuery, setIconQuery] = useState('');
  const [iconResults, setIconResults] = useState<MarketplaceIconThemeResult[] | null>(null);
  const [isIconSearching, setIsIconSearching] = useState(false);
  const [iconSearchError, setIconSearchError] = useState<string | null>(null);
  const [brokenIconThemeIcons, setBrokenIconThemeIcons] = useState<Set<string>>(new Set());
  const iconSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconSearchRequestIdRef = useRef(0);
  const [iconHoveredKey, setIconHoveredKey] = useState<string | null>(null);
  const [iconPinnedKey, setIconPinnedKey] = useState<string | null>(null);
  const activeIconPreviewKey = iconHoveredKey ?? iconPinnedKey;
  const activeIconResult = activeIconPreviewKey ? iconResults?.find((r) => iconResultKey(r) === activeIconPreviewKey) : undefined;
  const iconPreviewCacheRef = useRef<Map<string, IconThemePreviewAssets | 'loading' | 'failed'>>(new Map());
  const [, setIconPreviewTick] = useState(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (iconSearchDebounceRef.current) clearTimeout(iconSearchDebounceRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!results || results.length === 0) return;
    const queue = results.filter((r) => !themeCacheRef.current.has(resultKey(r)));
    if (queue.length === 0) return;

    let cancelled = false;
    let cursor = 0;

    async function worker() {
      while (!cancelled) {
        const item = queue[cursor++];
        if (!item) return;
        const key = resultKey(item);
        try {
          const file = await fetchMarketplaceVsix(item);
          const theme = await importThemeFile(file);
          themeCacheRef.current.set(key, theme);
        } catch {
          // Not worth surfacing per-row — the swatch/preview just falls back to a neutral placeholder.
          themeCacheRef.current.set(key, 'failed');
        }
        if (!cancelled) setPreviewTick((v) => v + 1);
      }
    }

    const workers = Array.from({ length: Math.min(PREVIEW_CONCURRENCY, queue.length) }, worker);
    Promise.all(workers).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [results]);

  function ensureIconPreviewLoaded(key: string, vsixSource: { displayName: string; publisherName: string; extensionName: string; version: string; vsixUrl: string }) {
    if (iconPreviewCacheRef.current.has(key)) return;
    iconPreviewCacheRef.current.set(key, 'loading');
    setIconPreviewTick((v) => v + 1);
    fetchMarketplaceVsix(vsixSource)
      .then(loadIconThemePreview)
      .then((assets) => {
        iconPreviewCacheRef.current.set(key, assets);
        setIconPreviewTick((v) => v + 1);
      })
      .catch((err: unknown) => {
        if (!(err instanceof MarketplaceError) && !(err instanceof IconThemePreviewError)) console.error('Icon theme preview failed:', err);
        iconPreviewCacheRef.current.set(key, 'failed');
        setIconPreviewTick((v) => v + 1);
      });
  }

  useEffect(() => {
    if (activeIconPreviewKey && activeIconResult) ensureIconPreviewLoaded(activeIconPreviewKey, activeIconResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIconPreviewKey, activeIconResult]);

  function describeVariants(theme: ImportedTheme): string {
    return theme.variants.length === 2 ? 'dark & light' : theme.variants[0].mode;
  }

  // Importing always replaces both modes wholesale (see importTheme in
  // AssignmentsContext) — even a dark-only theme clears light — so this has
  // to check both modes for existing work, not just the ones the incoming
  // theme happens to define. Checking only the incoming theme's modes would
  // let a dark-only import silently wipe real light-mode work with no warning.
  function hasExistingWork(): boolean {
    return (['dark', 'light'] as const).some((m) => {
      const c = chromeFor(m);
      return assignmentsFor(m).size > 0 || Boolean(c.background) || Boolean(c.foreground);
    });
  }

  function finishImport(theme: ImportedTheme, closeAfter: boolean, source: ImportSource) {
    // The imported theme's own name becomes `productThemeName`, not
    // `themeName` directly — ExportPanel's auto-fill picks it up from
    // there (see composeAutoThemeName), so a custom name the user already
    // typed into the Theme name box isn't silently overwritten.
    importTheme(theme);
    track(source === 'upload' ? 'theme_imported' : 'marketplace_theme_forked');
    onImported(`Imported "${theme.name}" (${describeVariants(theme)}) — tweak the colors and export when ready.`);
    if (closeAfter) onClose();
  }

  // `closeAfter` is false for a Marketplace "Use" — picking a theme there
  // doesn't preclude also pairing an icon theme in the next tab, so the
  // dialog stays open rather than forcing a reopen for that second step.
  // Uploading a file has no such follow-up, so it still closes on success.
  function handleParsedTheme(theme: ImportedTheme, closeAfter: boolean, source: ImportSource) {
    if (hasExistingWork()) setPendingImport({ theme, closeAfter, source });
    else finishImport(theme, closeAfter, source);
  }

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-choosing the same file later
    if (!file) return;
    setUploadError(null);
    setIsImportingFile(true);
    try {
      const theme = await importThemeFile(file);
      handleParsedTheme(theme, true, 'upload');
    } catch (err) {
      setUploadError(err instanceof ImportError ? err.message : 'Could not import this file.');
    } finally {
      setIsImportingFile(false);
    }
  }

  function runSearch(q: string) {
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    searchMarketplaceThemes(q)
      .then((found) => {
        if (requestId !== searchRequestIdRef.current) return;
        setResults(found);
      })
      .catch((err: unknown) => {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchError(err instanceof MarketplaceError ? err.message : 'Something went wrong searching the Marketplace.');
        setResults(null);
      })
      .finally(() => {
        if (requestId === searchRequestIdRef.current) setIsSearching(false);
      });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value.trim()) {
      searchRequestIdRef.current++; // invalidate any in-flight request from before clearing
      setResults(null);
      setIsSearching(false);
      setSearchError(null);
      setPinnedKey(null);
      return;
    }
    searchDebounceRef.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (query.trim()) runSearch(query);
  }

  async function handleUseResult(e: MouseEvent, result: MarketplaceThemeResult) {
    e.stopPropagation(); // don't also re-pin the row we're about to leave
    setInstallingKey(resultKey(result));
    setSearchError(null);
    try {
      const file = await fetchMarketplaceVsix(result);
      const theme = await importThemeFile(file);
      handleParsedTheme(theme, false, 'marketplace');
    } catch (err) {
      setSearchError(
        err instanceof MarketplaceError || err instanceof ImportError ? err.message : `Could not import "${result.displayName}".`,
      );
    } finally {
      setInstallingKey(null);
    }
  }

  function runIconSearch(q: string) {
    const requestId = ++iconSearchRequestIdRef.current;
    setIsIconSearching(true);
    setIconSearchError(null);
    searchMarketplaceIconThemes(q)
      .then((found) => {
        if (requestId !== iconSearchRequestIdRef.current) return;
        setIconResults(found);
      })
      .catch((err: unknown) => {
        if (requestId !== iconSearchRequestIdRef.current) return;
        setIconSearchError(err instanceof MarketplaceError ? err.message : 'Something went wrong searching the Marketplace.');
        setIconResults(null);
      })
      .finally(() => {
        if (requestId === iconSearchRequestIdRef.current) setIsIconSearching(false);
      });
  }

  function handleIconQueryChange(value: string) {
    setIconQuery(value);
    if (iconSearchDebounceRef.current) clearTimeout(iconSearchDebounceRef.current);
    if (!value.trim()) {
      iconSearchRequestIdRef.current++;
      setIconResults(null);
      setIsIconSearching(false);
      setIconSearchError(null);
      setIconPinnedKey(null);
      return;
    }
    iconSearchDebounceRef.current = setTimeout(() => runIconSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function handlePairIconTheme(result: MarketplaceIconThemeResult) {
    const paired: PairedIconTheme = {
      publisherName: result.publisherName,
      extensionName: result.extensionName,
      displayName: result.displayName,
      iconUrl: result.iconUrl,
      vsixUrl: result.vsixUrl,
    };
    setPairedIconTheme(paired);
    track('icon_theme_paired');
  }

  const previewTheme = activePreviewKey ? themeCacheRef.current.get(activePreviewKey) : undefined;
  const previewResult = activePreviewKey ? results?.find((r) => resultKey(r) === activePreviewKey) : undefined;

  // A result we've confirmed can't be imported (icon-only theme, legacy
  // format we don't parse, corrupt vsix, ...) is useless here — this tab
  // only deals in color themes, so once the background fetch above resolves
  // one to 'failed' it's dropped rather than left as a dead "Use" button.
  const visibleResults = results?.filter((r) => themeCacheRef.current.get(resultKey(r)) !== 'failed');

  const background = chrome.background ?? baselineColorsFor(mode)['editor.background'];
  const foreground = chrome.foreground ?? baselineColorsFor(mode)['editor.foreground'];

  return (
    <div
      className="import-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={tab === 'upload' ? 'import-dialog' : 'import-dialog import-dialog-wide'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <div className="import-dialog-header">
          <h2 id="import-dialog-title" className="import-dialog-title">
            Import a theme
          </h2>
          <button type="button" className="import-dialog-close-btn" onClick={onClose} aria-label="Close" autoFocus>
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="import-dialog-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upload'}
            className={tab === 'upload' ? 'import-dialog-tab import-dialog-tab-active' : 'import-dialog-tab'}
            onClick={() => setTab('upload')}
          >
            <UploadIcon size={13} /> Upload file
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'search'}
            className={tab === 'search' ? 'import-dialog-tab import-dialog-tab-active' : 'import-dialog-tab'}
            onClick={() => setTab('search')}
          >
            <SearchIcon size={13} /> Search Marketplace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'icon-theme'}
            className={tab === 'icon-theme' ? 'import-dialog-tab import-dialog-tab-active' : 'import-dialog-tab'}
            onClick={() => setTab('icon-theme')}
          >
            <FolderIcon size={13} /> Icon Theme
          </button>
        </div>

        <div className="import-dialog-body">
          {tab === 'upload' && (
            <div className="import-upload-pane">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.vsix,application/json"
                className="visually-hidden"
                onChange={handleFileChosen}
                aria-label="Choose a VS Code theme file"
              />
              <button
                type="button"
                className="import-upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImportingFile}
              >
                <UploadIcon size={22} />
                <span className="import-upload-dropzone-title">{isImportingFile ? 'Importing…' : 'Choose a theme file'}</span>
                <span className="import-upload-dropzone-hint">A VS Code color-theme .json, or a theme extension's .vsix</span>
              </button>
              {uploadError && <div className="import-dialog-error">{uploadError}</div>}
            </div>
          )}

          {tab === 'search' && (
            <div className="import-search-pane">
              <form className="marketplace-search-form" onSubmit={handleSearchSubmit}>
                <SearchIcon size={14} className="marketplace-search-icon" />
                <input
                  type="text"
                  className="marketplace-search-input"
                  placeholder='Search the Marketplace — e.g. "dracula", "one dark"'
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  aria-label="Search the VS Code Marketplace for a theme"
                  autoFocus
                />
              </form>

              <div className="marketplace-search-layout">
                <div className="marketplace-results">
                  {isSearching && <div className="marketplace-status">Searching…</div>}
                  {!isSearching && searchError && <div className="marketplace-status marketplace-status-error">{searchError}</div>}
                  {!isSearching && !searchError && results !== null && visibleResults?.length === 0 && (
                    <div className="marketplace-status">No themes found for "{query.trim()}".</div>
                  )}
                  {!isSearching && !searchError && results === null && (
                    <div className="marketplace-status">Search for a theme by name, e.g. "one dark" or "dracula".</div>
                  )}
                  {!isSearching &&
                    !searchError &&
                    visibleResults?.map((r) => {
                      const key = resultKey(r);
                      const isInstalling = installingKey === key;
                      const showIcon = r.iconUrl && !brokenIcons.has(key);
                      const cached = themeCacheRef.current.get(key);
                      const cachedTheme = cached && cached !== 'failed' ? cached : null;
                      const swatchVariant = cachedTheme?.variants[0];
                      const dots = swatchVariant
                        ? [PRESET_SCOPES.keywords, PRESET_SCOPES.strings, PRESET_SCOPES.functions]
                            .map((scope) => swatchVariant.assignments.get(scope))
                            .filter((c): c is string => Boolean(c))
                        : [];
                      return (
                        <div
                          className={key === activePreviewKey ? 'marketplace-result marketplace-result-active' : 'marketplace-result'}
                          key={key}
                          onMouseEnter={() => setHoveredKey(key)}
                          onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                          onClick={() => setPinnedKey(key)}
                        >
                          <div className="marketplace-result-visual">
                            {showIcon ? (
                              <img
                                src={r.iconUrl!}
                                alt=""
                                className="marketplace-result-icon"
                                loading="lazy"
                                onError={() => setBrokenIcons((prev) => new Set(prev).add(key))}
                              />
                            ) : (
                              <div className="marketplace-result-icon marketplace-result-icon-placeholder" aria-hidden="true" />
                            )}
                            <div
                              className="marketplace-result-swatch"
                              style={swatchVariant?.chrome.background ? { background: swatchVariant.chrome.background } : undefined}
                              title={swatchVariant ? "Preview of this theme's colors" : undefined}
                            >
                              {!cached && <span className="marketplace-swatch-skeleton" aria-hidden="true" />}
                              {dots.map((c, i) => (
                                <span key={i} className="marketplace-swatch-dot" style={{ background: c }} />
                              ))}
                            </div>
                          </div>
                          <div className="marketplace-result-text">
                            <div className="marketplace-result-name">
                              {r.displayName} <span className="marketplace-result-publisher">by {r.publisherDisplayName}</span>
                            </div>
                            {r.shortDescription && <div className="marketplace-result-desc">{r.shortDescription}</div>}
                            {r.installCount !== null && (
                              <div className="marketplace-result-installs">{formatInstallCount(r.installCount)} installs</div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="marketplace-use-btn"
                            onClick={(e) => handleUseResult(e, r)}
                            disabled={installingKey !== null}
                          >
                            {isInstalling ? 'Importing…' : 'Use'}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="marketplace-preview-pane">
                  {!activePreviewKey && (
                    <div className="theme-preview-empty">Hover or tap a theme to preview it here.</div>
                  )}
                  {activePreviewKey && !previewTheme && <div className="theme-preview-empty">Loading preview…</div>}
                  {activePreviewKey && previewTheme === 'failed' && (
                    <div className="theme-preview-empty">Couldn't load a preview for this theme.</div>
                  )}
                  {activePreviewKey && previewTheme && previewTheme !== 'failed' && (
                    <>
                      <div className="marketplace-preview-title">{previewResult?.displayName ?? previewTheme.name}</div>
                      <ThemePreview language={language} code={code} variant={previewTheme.variants[0]} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'icon-theme' && (
            <div className="import-search-pane">
              <p className="field-hint icon-theme-intro">
                Pair an existing Marketplace icon theme with{' '}
                {pairedIconTheme ? (
                  <>
                    your current pairing, <b>{pairedIconTheme.displayName}</b>,
                  </>
                ) : (
                  'this color theme'
                )}{' '}
                — it installs alongside your export as a recommended extension, never copied in.
              </p>
              <form className="marketplace-search-form" onSubmit={(e) => e.preventDefault()}>
                <SearchIcon size={14} className="marketplace-search-icon" />
                <input
                  type="text"
                  className="marketplace-search-input"
                  placeholder='Search icon themes — e.g. "material", "seti"'
                  value={iconQuery}
                  onChange={(e) => handleIconQueryChange(e.target.value)}
                  aria-label="Search the VS Code Marketplace for an icon theme"
                  autoFocus
                />
              </form>

              <div className="marketplace-search-layout">
                <div className="marketplace-results">
                  {isIconSearching && <div className="marketplace-status">Searching…</div>}
                  {!isIconSearching && iconSearchError && (
                    <div className="marketplace-status marketplace-status-error">{iconSearchError}</div>
                  )}
                  {!isIconSearching && !iconSearchError && iconResults !== null && iconResults.length === 0 && (
                    <div className="marketplace-status">No icon themes found for "{iconQuery.trim()}".</div>
                  )}
                  {!isIconSearching && !iconSearchError && iconResults === null && (
                    <div className="marketplace-status">Search for an icon theme by name, e.g. "material" or "seti".</div>
                  )}
                  {!isIconSearching &&
                    !iconSearchError &&
                    iconResults?.map((r) => {
                      const key = iconResultKey(r);
                      const showIcon = r.iconUrl && !brokenIconThemeIcons.has(key);
                      return (
                        <div
                          className={key === activeIconPreviewKey ? 'marketplace-result marketplace-result-active' : 'marketplace-result'}
                          key={key}
                          onMouseEnter={() => setIconHoveredKey(key)}
                          onMouseLeave={() => setIconHoveredKey((k) => (k === key ? null : k))}
                          onClick={() => setIconPinnedKey(key)}
                        >
                          {showIcon ? (
                            <img
                              src={r.iconUrl!}
                              alt=""
                              className="marketplace-result-icon"
                              loading="lazy"
                              onError={() => setBrokenIconThemeIcons((prev) => new Set(prev).add(key))}
                            />
                          ) : (
                            <div className="marketplace-result-icon marketplace-result-icon-placeholder" aria-hidden="true" />
                          )}
                          <div className="marketplace-result-text">
                            <div className="marketplace-result-name">
                              {r.displayName} <span className="marketplace-result-publisher">by {r.publisherDisplayName}</span>
                            </div>
                            {r.shortDescription && <div className="marketplace-result-desc">{r.shortDescription}</div>}
                            {r.installCount !== null && (
                              <div className="marketplace-result-installs">{formatInstallCount(r.installCount)} installs</div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="marketplace-use-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePairIconTheme(r);
                            }}
                          >
                            Pair
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="marketplace-preview-pane">
                  {!activeIconPreviewKey && (
                    <div className="theme-preview-empty">Hover or tap a theme to preview its real icons here.</div>
                  )}
                  {activeIconPreviewKey &&
                    (() => {
                      const cached = iconPreviewCacheRef.current.get(activeIconPreviewKey);
                      if (!cached || cached === 'loading') return <div className="theme-preview-empty">Loading real icons…</div>;
                      if (cached === 'failed') return <div className="theme-preview-empty">Couldn't load a preview for this icon theme.</div>;
                      return (
                        <>
                          <div className="marketplace-preview-title">{activeIconResult?.displayName}</div>
                          <IconThemeExplorerPreview assets={cached} background={background} foreground={foreground} />
                        </>
                      );
                    })()}
                </div>
              </div>

              {pairedIconTheme && (
                <div className="icon-theme-current-pairing">
                  Currently paired:{' '}
                  <a href={marketplaceItemUrl(pairedIconTheme.publisherName, pairedIconTheme.extensionName)} target="_blank" rel="noreferrer noopener">
                    {pairedIconTheme.displayName}
                  </a>
                  <button type="button" className="remove-assignment-btn" onClick={() => setPairedIconTheme(null)} title="Remove pairing">
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {pendingImport && (
        <ConfirmDialog
          title={`Import "${pendingImport.theme.name}"?`}
          body={
            <>
              This replaces all of your current color assignments and background/text overrides — for{' '}
              <b>both dark and light</b>, even if "{pendingImport.theme.name}" only defines{' '}
              {describeVariants(pendingImport.theme)}. This can't be undone.
            </>
          }
          confirmLabel="Import & replace"
          danger
          onConfirm={() => {
            const { theme, closeAfter, source } = pendingImport;
            setPendingImport(null);
            finishImport(theme, closeAfter, source);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}
