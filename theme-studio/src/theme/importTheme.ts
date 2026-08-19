import { strFromU8, unzipSync } from 'fflate';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { parseColorToHex, relativeLuminance } from './colorParse';
import type { ChromeOverride } from './chrome';
import type { ThemeMode } from './mode';

// Real-world theme JSON is routinely JSONC, not strict JSON — VS Code's own
// loader tolerates `//`/`/* */` comments and trailing commas, and a lot of
// published themes rely on that (hand-edited files, copy-pasted snippets
// with a stray trailing comma left in). Plain JSON.parse rejects all of
// that outright; probing ~300 real Marketplace themes with this app's
// import path, that was the cause of about 45% of them failing outright.
// A leading BOM (some editors save theme files that way) trips JSON.parse
// too, so that's stripped here as well.
function parseLenientJson(text: string): unknown {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const errors: ParseError[] = [];
  const result = parseJsonc(withoutBom, errors, { allowTrailingComma: true });
  if (result === undefined) throw new SyntaxError('Could not parse as JSON or JSONC.');
  return result;
}

export interface ImportedVariant {
  mode: ThemeMode;
  chrome: ChromeOverride;
  assignments: Map<string, string>;
}

export interface ImportedTheme {
  name: string;
  /** One entry per mode found — a plain theme JSON yields one, a VSIX with both dark and light yields two. */
  variants: ImportedVariant[];
}

/** Thrown for anything that isn't a bug — a bad/unrecognized file — so callers can show the message as-is. */
export class ImportError extends Error {}

interface RawVSCodeTheme {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
  tokenColors?: Array<{
    scope?: string | string[];
    settings?: { foreground?: string };
  }>;
}

function resolveMode(type: string | undefined, uiTheme: string | undefined, backgroundHex: string | null): ThemeMode {
  for (const candidate of [type, uiTheme]) {
    if (candidate === 'light' || candidate === 'hc-light' || candidate === 'vs') return 'light';
    if (candidate === 'dark' || candidate === 'hc-black' || candidate === 'vs-dark') return 'dark';
  }
  // Neither field is reliably present on hand-edited themes — fall back to
  // reading the actual background color, the same signal a human would use.
  if (backgroundHex) return relativeLuminance(backgroundHex) > 0.5 ? 'light' : 'dark';
  return 'dark';
}

function parseThemeObject(raw: unknown, fallbackName: string, uiTheme?: string): { name: string; variant: ImportedVariant } {
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportError('Not a valid VS Code theme file.');
  }
  const theme = raw as RawVSCodeTheme;
  if (!theme.tokenColors && !theme.colors) {
    throw new ImportError('Not a valid VS Code theme file — missing "tokenColors" and "colors".');
  }

  const colors = theme.colors ?? {};
  const backgroundHex = colors['editor.background'] ? parseColorToHex(colors['editor.background']) : null;
  const foregroundHex = colors['editor.foreground'] ? parseColorToHex(colors['editor.foreground']) : null;
  const mode = resolveMode(theme.type, uiTheme, backgroundHex);

  const chrome: ChromeOverride = {};
  if (backgroundHex) chrome.background = backgroundHex;
  if (foregroundHex) chrome.foreground = foregroundHex;

  const assignments = new Map<string, string>();
  for (const entry of theme.tokenColors ?? []) {
    const fg = entry.settings?.foreground;
    if (!fg) continue;
    const hex = parseColorToHex(fg);
    if (!hex) continue;
    const scopes = Array.isArray(entry.scope) ? entry.scope : (entry.scope ?? '').split(',');
    for (const rawScope of scopes) {
      const scope = rawScope.trim();
      // Last one wins, matching the file's own top-to-bottom cascade.
      if (scope) assignments.set(scope, hex);
    }
  }

  return { name: theme.name?.trim() || fallbackName, variant: { mode, chrome, assignments } };
}

function stripExtension(filename: string): string {
  return filename.replace(/\.(json|vsix)$/i, '').trim() || 'Imported Theme';
}

function importJsonBytes(bytes: Uint8Array, fallbackName: string): ImportedTheme {
  let parsed: unknown;
  try {
    parsed = parseLenientJson(strFromU8(bytes));
  } catch {
    throw new ImportError('Could not parse this file as JSON.');
  }
  const { name, variant } = parseThemeObject(parsed, fallbackName);
  return { name, variants: [variant] };
}

interface VsixThemeContribution {
  label?: string;
  path?: string;
  uiTheme?: string;
}

function importVsixBytes(bytes: Uint8Array, fallbackName: string): ImportedTheme {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ImportError('Could not read this .vsix file — it may be corrupted.');
  }

  const packageBytes = files['extension/package.json'];
  if (!packageBytes) {
    throw new ImportError("This .vsix doesn't look like a theme extension (no extension/package.json).");
  }
  let pkg: { displayName?: string; name?: string; contributes?: { themes?: VsixThemeContribution[] } };
  try {
    pkg = parseLenientJson(strFromU8(packageBytes)) as typeof pkg;
  } catch {
    throw new ImportError("This .vsix's package.json is not valid JSON.");
  }

  const contributions = pkg.contributes?.themes ?? [];
  if (contributions.length === 0) {
    throw new ImportError("This .vsix doesn't declare any color themes.");
  }

  const extensionName = pkg.displayName?.trim() || pkg.name?.trim() || fallbackName;
  const variantsByMode = new Map<ThemeMode, ImportedVariant>();

  for (const contribution of contributions) {
    if (!contribution.path) continue;
    const themeBytes = files[`extension/${contribution.path.replace(/^\.\//, '')}`];
    if (!themeBytes) continue;
    let variant: ImportedVariant;
    try {
      // Also covers legacy .tmTheme (plist/XML) variants — parseThemeObject
      // rejects whatever parseLenientJson makes of the XML, so both failure
      // modes land here and get skipped the same way as a corrupt JSON file.
      const themeJson = parseLenientJson(strFromU8(themeBytes));
      variant = parseThemeObject(themeJson, contribution.label || extensionName, contribution.uiTheme).variant;
    } catch {
      continue; // Skip an unreadable/unsupported variant rather than failing the whole import.
    }
    // A theme can contribute more than one dark (or light) variant — keep
    // only the first of each so export still maps 1:1 onto our two modes.
    if (!variantsByMode.has(variant.mode)) variantsByMode.set(variant.mode, variant);
  }

  if (variantsByMode.size === 0) {
    throw new ImportError('Could not read any theme files inside this .vsix.');
  }

  return { name: extensionName, variants: [...variantsByMode.values()] };
}

const ZIP_MAGIC = [0x50, 0x4b]; // 'PK'

/** Parses a `.json` VS Code color-theme file or a `.vsix` theme extension into assignments this app already understands. */
export async function importThemeFile(file: File): Promise<ImportedTheme> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fallbackName = stripExtension(file.name);
  const looksLikeZip = bytes.length > 2 && bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1];
  const isVsix = file.name.toLowerCase().endsWith('.vsix') || looksLikeZip;

  return isVsix ? importVsixBytes(bytes, fallbackName) : importJsonBytes(bytes, fallbackName);
}
