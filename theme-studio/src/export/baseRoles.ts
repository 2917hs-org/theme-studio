import { ROLE_SCOPES, type PresetField } from '../theme/presetPalette';
import { baselineColorsFor } from '../theme/baseline';
import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';

// Terminal/editor export targets (Windows Terminal, iTerm2, Zed) only ever
// need a small set of "base" colors — background, foreground, and a handful
// of accents — not the full ~160-scope map a VSIX carries. This is how any
// current theme (hand-colored, preset-applied, or imported) gets reduced
// down to that shape: for each accent field, walk every real TextMate scope
// ROLE_SCOPES says belongs to it and use the first one that's actually been
// assigned a color. A hand-colored theme that only ever touched
// `entity.name.function` (never the umbrella `keyword`/`string`) still
// resolves correctly, because this checks every scope in the field, not
// just one hardcoded representative.
const ACCENT_FIELDS: PresetField[] = [
  'keywords',
  'strings',
  'functions',
  'numbers',
  'types',
  'constants',
  'tags',
  'variables',
  'storage',
  'markup',
];

const SCOPES_BY_FIELD: Partial<Record<PresetField, string[]>> = {};
for (const role of Object.values(ROLE_SCOPES)) {
  (SCOPES_BY_FIELD[role.field] ??= []).push(...role.scopes);
}

function colorForField(assignments: Map<string, string>, field: PresetField): string | undefined {
  for (const scope of SCOPES_BY_FIELD[field] ?? []) {
    const color = assignments.get(scope);
    if (color) return color;
  }
  return undefined;
}

export interface BaseRoles {
  background: string;
  foreground: string;
  /** Whatever accent colors this theme actually has, in a fixed field order — fed to deriveAnsiPalette for hue matching. */
  accents: string[];
  /** How many of the fields in ACCENT_FIELDS resolved to a real assigned color — the signal used to decide whether a terminal export would look coherent, vs. mostly synthesized fallback colors. */
  populatedAccentCount: number;
}

/** The minimum number of real accent colors a theme needs before a terminal/editor export target is worth offering — below this, most of the palette would be synthesized fallback rather than anything the user actually picked. */
export const MIN_POPULATED_ACCENTS_FOR_EXTERNAL_EXPORT = 3;

export function extractBaseRoles(mode: ThemeMode, assignments: Map<string, string>, chrome: ChromeOverride): BaseRoles {
  const baseline = baselineColorsFor(mode, chrome);
  const accents = ACCENT_FIELDS.map((field) => colorForField(assignments, field)).filter((c): c is string => Boolean(c));
  return {
    background: baseline['editor.background'],
    foreground: baseline['editor.foreground'],
    accents,
    populatedAccentCount: accents.length,
  };
}

/** Per-field accent colors (only the ones actually assigned) — used by exporters that want to address specific roles (e.g. Zed's named syntax keys) rather than just a hue-matched pool. */
export function accentColorsByField(assignments: Map<string, string>): Partial<Record<PresetField, string>> {
  const result: Partial<Record<PresetField, string>> = {};
  for (const field of Object.keys(SCOPES_BY_FIELD) as PresetField[]) {
    const color = colorForField(assignments, field);
    if (color) result[field] = color;
  }
  return result;
}
