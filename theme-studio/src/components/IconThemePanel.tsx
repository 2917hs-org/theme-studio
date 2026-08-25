import { useEffect, useRef, useState } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import {
  searchMarketplaceIconThemes,
  marketplaceItemUrl,
  MarketplaceError,
  type MarketplaceIconThemeResult,
} from '../marketplace/searchMarketplace';
import { SearchIcon, LaunchIcon, TrashIcon } from './icons';

const SEARCH_DEBOUNCE_MS = 400;

function resultKey(r: MarketplaceIconThemeResult): string {
  return `${r.publisherName}.${r.extensionName}`;
}

function formatInstallCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Lets a user pair an existing Marketplace icon theme with the color theme
 * built here — search and reference only. Theme Studio has no icon-theme
 * assignment state (no colorable scopes to click, nothing to preview
 * against real icon assets), so unlike the color-theme search this never
 * downloads a .vsix: a pairing is just a publisher + extension id, written
 * into the export as an `extensionPack` entry (see buildVsix.ts) rather than
 * copied in.
 */
export function IconThemePanel() {
  const { pairedIconTheme, setPairedIconTheme } = useAssignments();
  const [isChanging, setIsChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketplaceIconThemeResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every new search (and on clear) so a slow, superseded request can't overwrite what a later one already rendered.
  const searchRequestIdRef = useRef(0);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    },
    [],
  );

  function runSearch(q: string) {
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    searchMarketplaceIconThemes(q)
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
      return;
    }
    searchDebounceRef.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function startChanging() {
    setIsChanging(true);
    setQuery('');
    setResults(null);
    setSearchError(null);
  }

  function handlePair(result: MarketplaceIconThemeResult) {
    setPairedIconTheme({
      publisherName: result.publisherName,
      extensionName: result.extensionName,
      displayName: result.displayName,
      iconUrl: result.iconUrl,
    });
    setIsChanging(false);
  }

  if (pairedIconTheme && !isChanging) {
    const key = `${pairedIconTheme.publisherName}.${pairedIconTheme.extensionName}`;
    const showIcon = pairedIconTheme.iconUrl && !brokenIcons.has(key);
    return (
      <div className="icon-theme-paired">
        {showIcon ? (
          <img
            src={pairedIconTheme.iconUrl!}
            alt=""
            className="marketplace-result-icon"
            onError={() => setBrokenIcons((prev) => new Set(prev).add(key))}
          />
        ) : (
          <div className="marketplace-result-icon marketplace-result-icon-placeholder" aria-hidden="true" />
        )}
        <div className="icon-theme-paired-text">
          <div className="marketplace-result-name">{pairedIconTheme.displayName}</div>
          <a
            className="icon-theme-paired-link"
            href={marketplaceItemUrl(pairedIconTheme.publisherName, pairedIconTheme.extensionName)}
            target="_blank"
            rel="noreferrer noopener"
          >
            View on Marketplace <LaunchIcon size={10} />
          </a>
        </div>
        <div className="icon-theme-paired-actions">
          <button type="button" className="marketplace-use-btn" onClick={startChanging}>
            Change
          </button>
          <button
            type="button"
            className="remove-assignment-btn"
            onClick={() => setPairedIconTheme(null)}
            title="Remove pairing"
            aria-label="Remove paired icon theme"
          >
            <TrashIcon size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="field-hint icon-theme-intro">
        Pair an existing Marketplace icon theme with this color theme — it installs alongside your export as a
        recommended extension, never copied in.
      </p>
      <form className="marketplace-search-form" onSubmit={(e) => e.preventDefault()}>
        <SearchIcon size={14} className="marketplace-search-icon" />
        <input
          type="text"
          className="marketplace-search-input"
          placeholder='Search icon themes — e.g. "material", "seti"'
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          aria-label="Search the VS Code Marketplace for an icon theme"
        />
      </form>

      <div className="marketplace-results">
        {isSearching && <div className="marketplace-status">Searching…</div>}
        {!isSearching && searchError && <div className="marketplace-status marketplace-status-error">{searchError}</div>}
        {!isSearching && !searchError && results !== null && results.length === 0 && (
          <div className="marketplace-status">No icon themes found for "{query.trim()}".</div>
        )}
        {!isSearching && !searchError && results === null && (
          <div className="empty-state empty-state-compact">
            <div className="empty-state-body">Search for an icon theme by name to pair it with this color theme.</div>
          </div>
        )}
        {!isSearching &&
          !searchError &&
          results?.map((r) => {
            const key = resultKey(r);
            const showIcon = r.iconUrl && !brokenIcons.has(key);
            return (
              <div className="marketplace-result marketplace-result-static" key={key}>
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
                <div className="marketplace-result-text">
                  <div className="marketplace-result-name">
                    {r.displayName} <span className="marketplace-result-publisher">by {r.publisherDisplayName}</span>
                  </div>
                  {r.shortDescription && <div className="marketplace-result-desc">{r.shortDescription}</div>}
                  {r.installCount !== null && <div className="marketplace-result-installs">{formatInstallCount(r.installCount)} installs</div>}
                </div>
                <button type="button" className="marketplace-use-btn" onClick={() => handlePair(r)}>
                  Pair
                </button>
              </div>
            );
          })}
      </div>

      {isChanging && (
        <button type="button" className="icon-theme-cancel-btn" onClick={() => setIsChanging(false)}>
          Cancel
        </button>
      )}
    </>
  );
}
