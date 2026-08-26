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

// IncludeLatestVersionOnly(512) | IncludeStatistics(256) | IncludeAssetUri(128) | IncludeCategoryAndTags(4) | IncludeVersionProperties(16) | IncludeFiles(2)
const QUERY_FLAGS = 918;

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

/**
 * An icon theme picked from the Marketplace to pair with the color theme
 * built here — a reference (publisher + extension id), never a downloaded
 * copy. See buildVsix.ts. `vsixUrl` is kept only to re-fetch a live preview
 * of an already-paired theme (iconThemeAssets.ts) — nullable so a pairing
 * restored from a session saved before this field existed still loads, just
 * without a preview until re-paired.
 */
export interface PairedIconTheme {
  publisherName: string;
  extensionName: string;
  displayName: string;
  iconUrl: string | null;
  vsixUrl: string | null;
}

export interface MarketplaceIconThemeResult extends PairedIconTheme {
  publisherDisplayName: string;
  shortDescription: string | null;
  installCount: number | null;
  version: string;
  /** Never null for a fresh search result — a result search can't skip (see searchMarketplaceIconThemes). */
  vsixUrl: string;
}

/** The public listing page for an extension — used as the "view on Marketplace" link, never fetched by this app. */
export function marketplaceItemUrl(publisherName: string, extensionName: string): string {
  return `https://marketplace.visualstudio.com/items?itemName=${publisherName}.${extensionName}`;
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
  tags?: string[];
}

interface RawGalleryResponse {
  results?: Array<{ extensions?: RawGalleryExtension[] }>;
}

function buildCriteria(tag: string, query: string): Array<{ filterType: number; value: string }> {
  const trimmed = query.trim();
  const criteria: Array<{ filterType: number; value: string }> = [
    { filterType: FILTER_TYPE_CATEGORY, value: 'Themes' },
    { filterType: FILTER_TYPE_TARGET, value: 'Microsoft.VisualStudio.Code' },
    // The "Themes" category covers color themes and icon themes alike — the
    // tag is what actually distinguishes them, and VS Code auto-tags every
    // published extension by which `contributes.*` point it declares.
    { filterType: FILTER_TYPE_TAG, value: tag },
  ];
  if (trimmed) criteria.push({ filterType: FILTER_TYPE_SEARCH_TEXT, value: trimmed });
  return criteria;
}

async function queryGallery(criteria: Array<{ filterType: number; value: string }>, pageSize: number): Promise<RawGalleryExtension[]> {
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

  return data.results?.[0]?.extensions ?? [];
}

// Each result gets its .vsix downloaded client-side to render a color
// preview (see ImportThemeDialog) — kept modest so a single search doesn't
// trigger dozens of those downloads.
export async function searchMarketplaceThemes(query: string, pageSize = 16): Promise<MarketplaceThemeResult[]> {
  // Excludes icon-only themes (no colorThemes contribution for us to import)
  // here, rather than after the fact, so results never show a theme that
  // fails to preview and errors on "Use".
  const extensions = await queryGallery(buildCriteria('color-theme', query), pageSize);
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

// An icon theme is never imported into this app's own state (no colorable
// scopes, no assignment) — but its `.vsix` IS fetched on demand, client-side
// only, to render a real icon preview (iconThemeAssets.ts). That download
// stays entirely local: the export only ever references the extension by
// id (see buildVsix.ts), never repackages what's fetched here.
export async function searchMarketplaceIconThemes(query: string, pageSize = 16): Promise<MarketplaceIconThemeResult[]> {
  const extensions = await queryGallery(buildCriteria('icon-theme', query), pageSize);
  const results: MarketplaceIconThemeResult[] = [];

  for (const ext of extensions) {
    // The Marketplace's `icon-theme` tag covers both file icon themes (what
    // this feature actually pairs — folder/file icons) and *product* icon
    // themes (VS Code's own UI glyphs: chevrons, close buttons, ...), which
    // carry an additional `product-icon-theme` tag and have no
    // `contributes.iconThemes` at all — e.g. Material Product Icons. Those
    // would download fine but always fail to preview/resolve anything, so
    // they're filtered out here rather than shown as a guaranteed dead end.
    if (ext.tags?.includes('product-icon-theme')) continue;

    const version = ext.versions?.[0];
    const vsixFile = version?.files?.find((f) => f.assetType === VSIX_ASSET_TYPE);
    if (!version || !vsixFile) continue; // Can't render a real preview for an icon theme we can't download.

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

interface DownloadableResult {
  displayName: string;
  publisherName: string;
  extensionName: string;
  version: string;
  vsixUrl: string;
}

/** Downloads a search result's .vsix and wraps it as a File — the same shape `importThemeFile` already accepts from the upload tab, and what `loadIconThemePreview` (iconThemeAssets.ts) unzips for an icon theme, so every download path shares one fetcher. */
export async function fetchMarketplaceVsix(result: DownloadableResult): Promise<File> {
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
