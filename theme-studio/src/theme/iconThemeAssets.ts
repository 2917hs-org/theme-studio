import { strFromU8, unzipSync } from 'fflate';

export class IconThemePreviewError extends Error {}

/**
 * The handful of icon-definition slots this preview actually resolves and
 * renders — a fixed, representative mini file tree, not the real contents
 * of any project. Each is looked up in the icon theme's own maps (folder
 * names, file names, file extensions), the same lookup order VS Code itself
 * uses: an exact name match first, then by extension, then the theme's
 * default file/folder icon.
 */
export interface IconThemePreviewAssets {
  folderClosed: string | null;
  folderOpen: string | null;
  files: Array<{ name: string; dataUri: string | null }>;
  /** True if at least one resolved icon uses a font glyph instead of an image — those render as a generic fallback here rather than a real preview, so this flag lets the UI say so. */
  usesIconFonts: boolean;
}

interface RawIconDefinition {
  iconPath?: string;
  fontCharacter?: string;
}

interface RawIconThemeJson {
  iconDefinitions?: Record<string, RawIconDefinition>;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
}

const SAMPLE_FOLDER_CLOSED = 'src';
const SAMPLE_FOLDER_OPEN = 'components';
// A small, deliberately varied set — different extensions, one exact
// filename match (package.json), one dotfile (.gitignore) — enough to show
// the icon theme actually distinguishing file types, without pretending to
// be a real project.
const SAMPLE_FILES = ['index.ts', 'App.tsx', 'styles.css', 'package.json', 'README.md', '.gitignore'];

// Resolves a `./relative/../path.svg` against the icon-theme JSON's own
// directory inside the extension — the same join `path.posix.resolve` would
// do, written by hand since this runs in the browser with no Node `path`.
function resolveRelativePath(baseDir: string, relative: string): string {
  const parts = baseDir.split('/').filter(Boolean);
  for (const segment of relative.split('/').filter(Boolean)) {
    if (segment === '.') continue;
    else if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function mimeFor(path: string): string | null {
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  return null;
}

function extensionOf(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : null;
}

// Spreading a whole asset's bytes into String.fromCharCode (`...bytes`) risks
// blowing the call stack once a file gets into the tens-of-KB range — chunking
// keeps every call small regardless of icon asset size.
const BASE64_CHUNK_SIZE = 8192;
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * Unzips a real icon theme `.vsix` and resolves its actual icon assets for
 * a fixed sample file tree — client-side only, on demand (see the "Icon
 * Theme" tab in ImportThemeDialog.tsx), and never bundled into anything this app exports
 * (see buildVsix.ts's extensionPack reference instead). Image-based icon
 * definitions (`iconPath`, the common case — Material Icon Theme, most
 * others) resolve to real inline previews; font-glyph-based ones
 * (`fontCharacter`, e.g. Seti's default icon set) are detected but not
 * rendered — loading a third-party font file for a handful of glyphs isn't
 * worth the added complexity and CSP surface for this preview.
 */
export async function loadIconThemePreview(file: File): Promise<IconThemePreviewAssets> {
  let files: Record<string, Uint8Array>;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    files = unzipSync(bytes);
  } catch {
    throw new IconThemePreviewError("Couldn't read this icon theme's package.");
  }

  const packageBytes = files['extension/package.json'];
  if (!packageBytes) throw new IconThemePreviewError("This icon theme's package is missing its manifest.");

  let pkg: { contributes?: { iconThemes?: Array<{ path?: string }> } };
  try {
    pkg = JSON.parse(strFromU8(packageBytes));
  } catch {
    throw new IconThemePreviewError("This icon theme's manifest isn't valid JSON.");
  }

  const contribution = pkg.contributes?.iconThemes?.[0];
  if (!contribution?.path) throw new IconThemePreviewError("This extension doesn't define a file icon theme.");

  const jsonPath = resolveRelativePath('extension', contribution.path);
  const jsonBytes = files[jsonPath];
  if (!jsonBytes) throw new IconThemePreviewError("Couldn't find this icon theme's definition file.");

  let theme: RawIconThemeJson;
  try {
    theme = JSON.parse(strFromU8(jsonBytes));
  } catch {
    throw new IconThemePreviewError("This icon theme's definition file isn't valid JSON.");
  }

  const jsonDir = jsonPath.slice(0, jsonPath.lastIndexOf('/'));
  const definitions = theme.iconDefinitions ?? {};
  let usesIconFonts = false;

  function resolveDefinitionId(id: string | undefined): string | null {
    if (!id) return null;
    const def = definitions[id];
    if (!def) return null;
    if (def.iconPath) {
      const assetPath = resolveRelativePath(jsonDir, def.iconPath);
      const assetBytes = files[assetPath];
      const mime = mimeFor(assetPath);
      if (!assetBytes || !mime) return null;
      return `data:${mime};base64,${toBase64(assetBytes)}`;
    }
    if (def.fontCharacter) usesIconFonts = true;
    return null;
  }

  function resolveFolder(name: string, expanded: boolean): string | null {
    const map = expanded ? theme.folderNamesExpanded : theme.folderNames;
    const id = map?.[name.toLowerCase()] ?? (expanded ? theme.folderExpanded : theme.folder);
    return resolveDefinitionId(id);
  }

  function resolveFile(name: string): string | null {
    const byName = theme.fileNames?.[name.toLowerCase()];
    if (byName) return resolveDefinitionId(byName);
    const ext = extensionOf(name);
    const byExt = ext ? theme.fileExtensions?.[ext] : null;
    return resolveDefinitionId(byExt ?? theme.file);
  }

  return {
    folderClosed: resolveFolder(SAMPLE_FOLDER_CLOSED, false),
    folderOpen: resolveFolder(SAMPLE_FOLDER_OPEN, true),
    files: SAMPLE_FILES.map((name) => ({ name, dataUri: resolveFile(name) })),
    usesIconFonts,
  };
}
