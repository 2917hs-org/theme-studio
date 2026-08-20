import { zipSync, strToU8 } from 'fflate';
import { buildVSCodeTheme } from '../theme/themeBuilder';
import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';

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

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c);
}

// Same brand mark as the favicon/header logo (see index.html), rasterized
// to a size VS Code's Extensions view and Marketplace listing expect. It's
// a static public asset, so fetching it here (rather than importing it as
// a build asset) keeps this module free of bundler-specific asset syntax.
const ICON_PATH = `${import.meta.env.BASE_URL}icon-192.png`;

async function fetchIconBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(ICON_PATH);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error('Failed to load extension icon:', err);
    return null;
  }
}

// One `.vsix` can, and by default now does, carry every mode the user has
// actually customized — `contributes.themes` is already an array in VS
// Code's own extension manifest format, so a Dark and a Light variant ship
// side by side as one real installable theme, exactly like theme packs on
// the Marketplace do. Callers still hand in a single variant when only one
// mode has anything worth exporting.
export async function buildVsixBlob(themeName: string, variants: ThemeVariant[]): Promise<Blob> {
  if (variants.length === 0) throw new Error('buildVsixBlob requires at least one theme variant.');
  const slug = slugify(themeName);
  const multiple = variants.length > 1;
  const labelFor = (mode: ThemeMode) => (multiple ? `${themeName} ${MODE_LABEL[mode]}` : themeName);

  const iconBytes = await fetchIconBytes();

  const packageJson = {
    name: slug,
    displayName: themeName,
    description: `A custom color theme generated with VS Code Theme Studio${multiple ? ' (Dark + Light).' : '.'}`,
    version: '1.0.0',
    publisher: 'theme-studio-local',
    engines: { vscode: '^1.74.0' },
    categories: ['Themes'],
    ...(iconBytes ? { icon: 'icon.png' } : {}),
    contributes: {
      themes: variants.map(({ mode }) => ({
        label: labelFor(mode),
        uiTheme: mode === 'dark' ? 'vs-dark' : 'vs',
        path: `./themes/${mode}.json`,
      })),
    },
  };

  const iconAsset = iconBytes
    ? '\n    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true" />'
    : '';
  const iconMetadata = iconBytes ? '\n    <Icon>extension/icon.png</Icon>' : '';

  const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${slug}" Version="1.0.0" Publisher="theme-studio-local"/>
    <DisplayName>${escapeXml(themeName)}</DisplayName>
    <Description xml:space="preserve">${escapeXml(packageJson.description)}</Description>
    <Tags>theme,color-theme</Tags>
    <Categories>Themes</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.74.0" />
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
</Types>
`;

  const files: Record<string, Uint8Array> = {
    'extension.vsixmanifest': strToU8(vsixManifest),
    '[Content_Types].xml': strToU8(contentTypes),
    'extension/package.json': strToU8(JSON.stringify(packageJson, null, 2)),
  };
  for (const { mode, assignments, chrome } of variants) {
    const theme = buildVSCodeTheme(labelFor(mode), mode, assignments, chrome);
    files[`extension/themes/${mode}.json`] = strToU8(JSON.stringify(theme, null, 2));
  }
  if (iconBytes) {
    files['extension/icon.png'] = iconBytes;
  }

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // a.click() only starts the download hand-off — some WebKit-based
  // browsers have truncated in-flight downloads when the object URL is
  // revoked in the same tick. A macrotask delay is enough for the browser
  // to have read the blob before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
