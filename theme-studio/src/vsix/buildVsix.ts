import { zipSync, strToU8 } from 'fflate';
import { buildVSCodeTheme } from '../theme/themeBuilder';
import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';

// The zip's contents are assembled from three independent pieces —
// `packageJson`, `vsixManifest`, and one theme JSON file per variant below.
// A future export format (e.g. a plain .json theme file with no VSIX
// wrapper, for users who just want the color values) would slot in as a
// sibling `buildXyzBlob` function reusing `buildVSCodeTheme` directly,
// without needing to touch the VSIX-specific packaging here.

export interface ThemeVariant {
  mode: ThemeMode;
  assignments: Map<string, string>;
  chrome?: ChromeOverride;
}

const MODE_LABEL: Record<ThemeMode, string> = { dark: 'Dark', light: 'Light' };

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom-theme';
}

// The technical identifier baked into the package itself (package.json's
// `name`, the vsixmanifest's `Id`) — distinct from `displayName`, which
// stays exactly what the user typed. Always carries the `vsts` product
// prefix, and folds in the paired icon theme's own extension name (already
// a valid slug, so reused as-is rather than re-derived from its display
// name) when one is paired. `themeName` itself already starting with
// "vsts" (e.g. it's literally "vsts", the no-selection default) is checked
// for rather than blindly prepending, so that case stays `vsts` instead of
// doubling up as `vsts-vsts`.
//
// NOT used for the downloaded filename — see ExportPanel.tsx's
// buildCurrentVsix, which derives that directly from the Theme name box's
// literal text (via `slugify` alone) so the two can never disagree.
export function buildExportSlug(themeName: string, pairedIconTheme?: PairedIconTheme | null): string {
  const themeSlug = slugify(themeName);
  const parts = themeSlug === 'vsts' || themeSlug.startsWith('vsts-') ? [themeSlug] : ['vsts', themeSlug];
  if (pairedIconTheme) parts.push(pairedIconTheme.extensionName);
  return parts.join('-');
}

// The Theme name field's own live display value —
// "vsts-[product]-[icon]-[mode]", each segment present only while that
// thing is actually selected/applicable, "vsts" alone when none are.
// Deliberately takes the *raw* product theme name (e.g. "Midnight"), not
// an already-composed string — feeding this function's own output back
// into itself (or into buildExportSlug above) would double up the icon
// segment, since it's already baked in once.
//
// `modeSuffix` records which VS Code UI mode this specific export actually
// contains — 'dark' or 'light' when it ships only one, omitted when it
// ships both (a two-variant pack isn't "the dark one", it covers both, the
// same as any published theme with a light+dark pair). Pass the export's
// single mode when exactly one has content, or null/undefined otherwise;
// see ExportPanel.tsx for how that's derived from what's actually colored.
export function composeAutoThemeName(
  productThemeName: string | null,
  pairedIconTheme?: PairedIconTheme | null,
  modeSuffix?: ThemeMode | null,
): string {
  const parts = ['vsts'];
  if (productThemeName) parts.push(slugify(productThemeName));
  if (pairedIconTheme) parts.push(pairedIconTheme.extensionName);
  if (modeSuffix) parts.push(modeSuffix);
  return parts.join('-');
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);
}

// Same brand mark as the favicon/header logo (see index.html), rasterized
// to a size VS Code's Extensions view and Marketplace listing expect. It's
// a static public asset, so fetching it here (rather than importing it as
// a build asset) keeps this module free of bundler-specific asset syntax.
const ICON_PATH = `${import.meta.env.BASE_URL}icon-192.png`;

// Kicked off below at module load, well before any export click, and
// mirrored into a plain variable (`iconBytesResolved`) the moment it
// settles. Safari only honors the `download` attribute when `a.click()`
// runs in the same synchronous task as the click event — even a single
// `await` on an already-resolved promise is enough of a gap for it to fall
// back to navigating the tab to the blob: URL instead of saving it, which
// then fails outright since a zip isn't something Safari can render inline
// (WebKitBlobResource error 1). `buildVsixBlobSync` below reads
// `iconBytesResolved` directly so the export path never awaits anything.
let iconBytesPromise: Promise<Uint8Array | null> | null = null;
let iconBytesResolved: Uint8Array | null = null;

function fetchIconBytes(): Promise<Uint8Array | null> {
  if (!iconBytesPromise) {
    // Wrapped in an async IIFE (not a bare `.then()` chain) so a
    // synchronous throw from `fetch` itself — e.g. an invalid-URL error,
    // which some fetch implementations raise before returning a promise —
    // is caught too, instead of escaping this module-load-time call.
    iconBytesPromise = (async () => {
      try {
        const res = await fetch(ICON_PATH);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch (err) {
        console.error('Failed to load extension icon:', err);
        return null;
      }
    })();
    iconBytesPromise.then((bytes) => {
      iconBytesResolved = bytes;
    });
  }
  return iconBytesPromise;
}
void fetchIconBytes();

// One `.vsix` can, and by default now does, carry every mode the user has
// actually customized — `contributes.themes` is already an array in VS
// Code's own extension manifest format, so a Dark and a Light variant ship
// side by side as one real installable theme, exactly like theme packs on
// the Marketplace do. Callers still hand in a single variant when only one
// mode has anything worth exporting.

// Shown under the theme name in VS Code's Extensions view. There's no
// marketplace to resolve a friendlier display name for a locally-installed
// .vsix — VS Code just prints this id verbatim — so it's worth keeping
// clean rather than a placeholder-looking value like the old
// "theme-studio-local".
const PUBLISHER = 'vscode-theme-studio';
const HOMEPAGE = 'https://2917hs-org.github.io/theme-studio/';
const REPOSITORY = 'https://github.com/2917hs-org/theme-studio';

function assembleVsix(themeName: string, variants: ThemeVariant[], iconBytes: Uint8Array | null, pairedIconTheme?: PairedIconTheme | null): Blob {
  if (variants.length === 0) throw new Error('buildVsixBlob requires at least one theme variant.');
  const slug = buildExportSlug(themeName, pairedIconTheme);
  const multiple = variants.length > 1;
  const labelFor = (mode: ThemeMode) => (multiple ? `${themeName} ${MODE_LABEL[mode]}` : themeName);
  const modeList = variants.map(({ mode }) => MODE_LABEL[mode]).join(' + ');

  // A pairing is a reference to someone else's already-published extension,
  // never a copy of its assets — `extensionPack` is VS Code's own mechanism
  // for "installing this also installs that", independently versioned and
  // attributed. See searchMarketplace.ts's PairedIconTheme doc comment.
  const iconThemeId = pairedIconTheme ? `${pairedIconTheme.publisherName}.${pairedIconTheme.extensionName}` : null;

  const packageJson = {
    name: slug,
    displayName: themeName,
    description: `A custom color theme generated with VS Code Theme Studio${multiple ? ' (Dark + Light).' : '.'}`,
    version: '1.0.0',
    publisher: PUBLISHER,
    engines: { vscode: '^1.74.0' },
    categories: ['Themes'],
    keywords: ['theme', 'color-theme'],
    homepage: HOMEPAGE,
    repository: { type: 'git', url: REPOSITORY },
    bugs: { url: `${REPOSITORY}/issues` },
    license: 'MIT',
    ...(iconBytes ? { icon: 'icon.png' } : {}),
    ...(iconThemeId ? { extensionPack: [iconThemeId] } : {}),
    contributes: {
      themes: variants.map(({ mode }) => ({
        label: labelFor(mode),
        uiTheme: mode === 'dark' ? 'vs-dark' : 'vs',
        path: `./themes/${mode}.json`,
      })),
    },
  };

  // VS Code's "Details" tab in the Extensions view renders this file
  // verbatim (and falls back to a blank "no README" state without it);
  // "Feature Contributions" lists `contributes.themes` above regardless,
  // but reads bare without any surrounding context. Both get real content
  // here instead of shipping empty.
  const readme = `# ${themeName}

A custom VS Code color theme${multiple ? ` shipping both **${modeList}** variants` : ` (${modeList})`}, built with [VS Code Theme Studio](${HOMEPAGE}).

## What's included

${variants.map(({ mode }) => `- **${labelFor(mode)}** — ${mode === 'dark' ? 'dark' : 'light'} UI theme (\`themes/${mode}.json\`)`).join('\n')}
${pairedIconTheme ? `\n## Pairs with\n\nInstalling this extension also installs [${pairedIconTheme.displayName}](https://marketplace.visualstudio.com/items?itemName=${iconThemeId}) — the icon theme it was previewed with in Theme Studio.\n` : ''}
## Changing colors

Open \`${themeName}\` in [Theme Studio](${HOMEPAGE}) to keep adjusting it, then re-export to update this extension.
`;

  const changelog = `# Changelog

## 1.0.0

Initial release, generated with [VS Code Theme Studio](${HOMEPAGE}).
`;

  const iconAsset = iconBytes
    ? '\n    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true" />'
    : '';
  const iconMetadata = iconBytes ? '\n    <Icon>extension/icon.png</Icon>' : '';
  const extensionPackProperty = iconThemeId
    ? `\n      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="${escapeXml(iconThemeId)}" />`
    : '';

  const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${slug}" Version="1.0.0" Publisher="${PUBLISHER}"/>
    <DisplayName>${escapeXml(themeName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(packageJson.description)}</Description>
    <Tags>theme,color-theme</Tags>
    <Categories>Themes</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.74.0" />${extensionPackProperty}
    </Properties>${iconMetadata}
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />${iconAsset}
  </Assets>
</PackageManifest>
`;

  const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="md" ContentType="text/markdown" />
</Types>
`;

  const files: Record<string, Uint8Array> = {
    'extension.vsixmanifest': strToU8(vsixManifest),
    '[Content_Types].xml': strToU8(contentTypes),
    'extension/package.json': strToU8(JSON.stringify(packageJson, null, 2)),
    'extension/README.md': strToU8(readme),
    'extension/CHANGELOG.md': strToU8(changelog),
  };
  for (const { mode, assignments, chrome } of variants) {
    const theme = buildVSCodeTheme(labelFor(mode), mode, assignments, chrome);
    files[`extension/themes/${mode}.json`] = strToU8(JSON.stringify(theme, null, 2));
  }
  if (iconBytes) {
    files['extension/icon.png'] = iconBytes;
  }

  const zipped = zipSync(files, { level: 6 });
  // 'application/octet-stream', not 'application/zip' — Safari's blob:
  // download handling (already worked around above for the sync-click and
  // CSP gaps) is more reliable with an explicitly-opaque MIME type; 'zip'
  // can still steer it toward its own archive-preview handling even with
  // the anchor's `download` attribute set. Doesn't affect the resulting
  // file: VS Code (like the OS download itself) goes by the .vsix
  // extension, never by this transient blob-level tag.
  return new Blob([zipped as BlobPart], { type: 'application/octet-stream' });
}

export async function buildVsixBlob(themeName: string, variants: ThemeVariant[], pairedIconTheme?: PairedIconTheme | null): Promise<Blob> {
  const iconBytes = await fetchIconBytes();
  return assembleVsix(themeName, variants, iconBytes, pairedIconTheme);
}

// The click-path entry point: synchronous end to end, so callers can build
// and hand off the download without ever awaiting (see the comment on
// `iconBytesResolved` above for why that matters on Safari). Reads whatever
// icon bytes have settled by now, shipping without one if the fetch is
// still in flight rather than blocking the export on it.
export function buildVsixBlobSync(themeName: string, variants: ThemeVariant[], pairedIconTheme?: PairedIconTheme | null): Blob {
  return assembleVsix(themeName, variants, iconBytesResolved, pairedIconTheme);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  // Both cleanup steps deferred to a macrotask, not run synchronously right
  // after click() — that's already true below for the URL (some WebKit
  // builds truncate an in-flight download if the object URL is revoked in
  // the same tick), and Safari in particular has also been reported to
  // drop the download's hand-off entirely if the anchor is detached from
  // the DOM before its own click-handling has fully settled, even though
  // click() itself returns synchronously. Removing the element on the same
  // delayed macrotask as the URL revocation covers both at once.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 30_000);
}
