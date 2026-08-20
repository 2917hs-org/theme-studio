// Talks directly to the public VS Code Marketplace gallery API — the same
// one vscode.dev and `vsce` use to browse/install extensions. No API key,
// and both the query endpoint and the asset CDN it points to
// (`*.gallerycdn.vsassets.io`) send `Access-Control-Allow-Origin: *`, so it
// works from a plain client-side fetch with no backend/proxy of our own.
const GALLERY_QUERY_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

const FILTER_TYPE_TAG = 1;
const FILTER_TYPE_CATEGORY = 5;
const FILTER_TYPE_TARGET = 8;
const FILTER_TYPE_SEARCH_TEXT = 10;

// IncludeLatestVersionOnly(512) | IncludeStatistics(256) | IncludeAssetUri(128) | IncludeVersionProperties(16) | IncludeFiles(2)
const QUERY_FLAGS = 914;

const VSIX_ASSET_TYPE = 'Microsoft.VisualStudio.Services.VSIXPackage';
const ICON_ASSET_TYPE = 'Microsoft.VisualStudio.Services.Icons.Default';

export class MarketplaceError extends Error {}

export interface MarketplaceThemeResult {
  publisherName: string;
  publisherDisplayName: string;
  extensionName: string;
  displayName: string;
  shortDescription: string | null;
  iconUrl: string | null;
  installCount: number | null;
  version: string;
  vsixUrl: string;
}

interface RawGalleryFile {
  assetType: string;
  source: string;
}

interface RawGalleryVersion {
  version: string;
  files?: RawGalleryFile[];
}

interface RawGalleryStatistic {
  statisticName: string;
  value: number;
}

interface RawGalleryExtension {
  publisher: { publisherName: string; displayName: string };
  extensionName: string;
  displayName: string;
  shortDescription?: string;
  versions?: RawGalleryVersion[];
  statistics?: RawGalleryStatistic[];
}

interface RawGalleryResponse {
  results?: Array<{ extensions?: RawGalleryExtension[] }>;
}

// Each result gets its .vsix downloaded client-side to render a color
// preview (see ImportThemeDialog) — kept modest so a single search doesn't
// trigger dozens of those downloads.
export async function searchMarketplaceThemes(query: string, pageSize = 16): Promise<MarketplaceThemeResult[]> {
  const trimmed = query.trim();
  const criteria: Array<{ filterType: number; value: string }> = [
    { filterType: FILTER_TYPE_CATEGORY, value: 'Themes' },
    { filterType: FILTER_TYPE_TARGET, value: 'Microsoft.VisualStudio.Code' },
    // The "Themes" category also covers file/product icon themes, which have
    // no colorThemes contribution for us to import — excluding those here
    // (rather than after the fact) keeps them out of results entirely instead
    // of showing a theme that fails to preview and errors on "Use".
    { filterType: FILTER_TYPE_TAG, value: 'color-theme' },
  ];
  if (trimmed) criteria.push({ filterType: FILTER_TYPE_SEARCH_TEXT, value: trimmed });

  let res: Response;
  try {
    res = await fetch(GALLERY_QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json;api-version=3.0-preview.1',
      },
      body: JSON.stringify({ filters: [{ criteria, pageNumber: 1, pageSize }], flags: QUERY_FLAGS }),
    });
  } catch {
    throw new MarketplaceError('Could not reach the VS Code Marketplace — check your connection and try again.');
  }

  if (!res.ok) {
    throw new MarketplaceError(`Marketplace search failed (HTTP ${res.status}). Please try again.`);
  }

  let data: RawGalleryResponse;
  try {
    data = await res.json();
  } catch {
    throw new MarketplaceError('The Marketplace returned an unexpected response.');
  }

  const extensions = data.results?.[0]?.extensions ?? [];
  const results: MarketplaceThemeResult[] = [];

  for (const ext of extensions) {
    const version = ext.versions?.[0];
    const vsixFile = version?.files?.find((f) => f.assetType === VSIX_ASSET_TYPE);
    if (!version || !vsixFile) continue; // Can't do anything with a theme we can't download.

    const iconFile = version.files?.find((f) => f.assetType === ICON_ASSET_TYPE);
    const installStat = ext.statistics?.find((s) => s.statisticName === 'install');

    results.push({
      publisherName: ext.publisher.publisherName,
      publisherDisplayName: ext.publisher.displayName,
      extensionName: ext.extensionName,
      displayName: ext.displayName,
      shortDescription: ext.shortDescription?.trim() || null,
      iconUrl: iconFile?.source ?? null,
      installCount: installStat ? Math.round(installStat.value) : null,
      version: version.version,
      vsixUrl: vsixFile.source,
    });
  }

  return results;
}

/** Downloads a search result's .vsix and wraps it as a File — the same shape `importThemeFile` already accepts from the upload tab, so both paths share one parser. */
export async function fetchMarketplaceVsix(result: MarketplaceThemeResult): Promise<File> {
  let res: Response;
  try {
    res = await fetch(result.vsixUrl);
  } catch {
    throw new MarketplaceError(`Could not download "${result.displayName}" — check your connection and try again.`);
  }
  if (!res.ok) {
    throw new MarketplaceError(`Could not download "${result.displayName}" (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const filename = `${result.publisherName}.${result.extensionName}-${result.version}.vsix`;
  return new File([blob], filename, { type: 'application/zip' });
}
