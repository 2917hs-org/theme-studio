import type { ThemeMode } from './mode';
import { contrastRatio, hexToHsv, hsvToHex, hexToRgb, rgbToHex, relativeLuminance } from './colorParse';
import { ROLE_SCOPES, type PresetField } from './presetPalette';
import type { ExtractedPalette } from './imageExtract';
import type { ImportedTheme } from './importTheme';

// WCAG AA for normal text — the acceptance bar every extracted accent must
// clear against the derived background (see ensureContrast).
const MIN_CONTRAST = 4.5;

/**
 * The seven roles chosen directly from the image's own clusters — the same
 * five accent fields PresetPicker's own swatch dots surface per preset card
 * (keywords/strings/functions/types/numbers), plus background and text.
 * Every other PresetField is derived from these (see deriveTheme) rather
 * than extracted, the same way an underspecified theme falls back to
 * neighboring colors elsewhere in this app.
 */
export type CoreField = 'background' | 'text' | 'keywords' | 'strings' | 'functions' | 'types' | 'numbers';

export const CORE_FIELDS: CoreField[] = ['background', 'text', 'keywords', 'strings', 'functions', 'types', 'numbers'];

export const CORE_FIELD_LABELS: Record<CoreField, string> = {
  background: 'Background',
  text: 'Text',
  keywords: 'Keywords',
  strings: 'Strings',
  functions: 'Functions',
  types: 'Types',
  numbers: 'Numbers',
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function adjustValue(hex: string, delta: number): string {
  const { h, s, v } = hexToHsv(hex);
  return hsvToHex(h, s, clamp01(v + delta));
}

function adjustSaturation(hex: string, delta: number): string {
  const { h, s, v } = hexToHsv(hex);
  return hsvToHex(h, clamp01(s + delta), v);
}

function mix(hexA: string, hexB: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * Nudges `hex` toward (or away from) white/black in HSV value, preserving
 * hue and saturation, until it clears `minRatio` against `background` —
 * the "recognizably from this photo, not just technically present in it"
 * contrast pass from the spec. Raw photo colors have no designed contrast,
 * unlike a hand-built preset, so this is the one place image-derived
 * accents need work a normal preset never does.
 */
export function ensureContrast(hex: string, background: string, minRatio = MIN_CONTRAST): string {
  if (contrastRatio(hex, background) >= minRatio) return hex;
  const bgIsDark = relativeLuminance(background) < 0.5;
  const { h, s, v: startV } = hexToHsv(hex);
  let v = startV;
  for (let i = 0; i < 30; i++) {
    v = clamp01(v + (bgIsDark ? 0.035 : -0.035));
    const candidate = hsvToHex(h, s, v);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
    if (v <= 0 || v >= 1) break;
  }
  // Last resort for a background so mid-gray no value shift clears the bar
  // (a fully desaturated near-mid background) — still keeps the hue.
  return hsvToHex(h, s, bgIsDark ? 1 : 0);
}

/**
 * Picks the seven CORE_FIELDS from an extracted palette — the same "small
 * palette → full theme" starting point PresetPicker's applyPreset() does
 * for a hand-authored preset, just sourced from photo clusters instead.
 * Most-constrained fields first: background and text are picked by
 * luminance/contrast, then accents are the most saturated remaining
 * clusters, spaced apart by hue so two near-identical accents don't both
 * get picked.
 */
export function chooseCoreFields(palette: ExtractedPalette, mode: ThemeMode): Record<CoreField, string> {
  const withLuminance = palette.colors.map((hex) => ({ hex, luminance: relativeLuminance(hex) }));

  const background =
    mode === 'dark'
      ? withLuminance.reduce((a, b) => (b.luminance < a.luminance ? b : a)).hex
      : withLuminance.reduce((a, b) => (b.luminance > a.luminance ? b : a)).hex;

  const withoutBackground = withLuminance.filter((c) => c.hex !== background);
  const textPool = withoutBackground.length > 0 ? withoutBackground : withLuminance;
  const text = textPool.reduce((a, b) => (contrastRatio(b.hex, background) > contrastRatio(a.hex, background) ? b : a)).hex;

  const accentPool = withoutBackground.filter((c) => c.hex !== text);
  const pool = accentPool.length > 0 ? accentPool : withLuminance;

  const bySaturation = [...pool].sort((a, b) => hexToHsv(b.hex).s - hexToHsv(a.hex).s);
  const picks: string[] = [];
  for (const c of bySaturation) {
    if (picks.length >= 5) break;
    const tooClose = picks.some((p) => hueDistance(hexToHsv(p).h, hexToHsv(c.hex).h) < 20);
    if (!tooClose || picks.length === 0) picks.push(c.hex);
  }
  // A very low-color image (a handful of clusters) may not have 5 distinct
  // accents worth of variety — pad with the closest thing available rather
  // than crashing on a missing field. The resulting theme will look flatter,
  // which is an honest reflection of the source image, not a bug.
  while (picks.length < 5) picks.push(bySaturation[picks.length % bySaturation.length]?.hex ?? text);

  const [keywords, strings, functions, types, numbers] = picks;
  return { background, text, keywords, strings, functions, types, numbers };
}

/**
 * Expands the seven core fields into every PresetField a theme needs
 * (mirrors ROLE_SCOPES' ~20-field shape) and runs the §4.3 contrast pass
 * over every extracted accent. Diff/invalid colors keep their conventional
 * hue (green/red/orange) regardless of the photo's own palette — every
 * built-in preset does the same (see presets.ts): they carry a fixed
 * meaning (added/removed/changed) that a photo-derived hue would undermine,
 * so only their intensity is shaped by the image, not their color family.
 */
export function deriveTheme(core: Record<CoreField, string>): { background: string; text: string; fields: Record<PresetField, string> } {
  const background = core.background;
  const text = ensureContrast(core.text, background);
  const keywords = ensureContrast(core.keywords, background);
  const strings = ensureContrast(core.strings, background);
  const functions = ensureContrast(core.functions, background);
  const types = ensureContrast(core.types, background);
  const numbers = ensureContrast(core.numbers, background);

  const bgIsDark = relativeLuminance(background) < 0.5;
  const towardVisible = bgIsDark ? 0.12 : -0.12;

  const semanticAccent = (hue: number) => {
    const saturation = Math.max(0.45, hexToHsv(text).s);
    return ensureContrast(hsvToHex(hue, saturation, bgIsDark ? 0.75 : 0.45), background, 3);
  };

  const fields: Record<PresetField, string> = {
    text,
    keywords,
    strings,
    functions,
    types,
    numbers,
    stringEscape: adjustValue(strings, towardVisible),
    regexp: adjustSaturation(strings, 0.15),
    constants: adjustValue(numbers, towardVisible * 0.8),
    storage: adjustSaturation(keywords, -0.2),
    punctuation: mix(text, background, 0.35),
    comments: mix(text, background, 0.5),
    functionsBuiltin: adjustValue(functions, towardVisible),
    typesBuiltin: adjustValue(types, towardVisible),
    variables: mix(text, background, 0.12),
    variablesProperty: mix(text, background, 0.22),
    tags: keywords,
    tagsAttribute: adjustValue(types, towardVisible * 0.8),
    markup: functions,
    diffInserted: semanticAccent(120),
    diffDeleted: semanticAccent(350),
    diffChanged: semanticAccent(35),
    invalid: semanticAccent(350),
  };

  return { background, text, fields };
}

/** Fans a resolved set of PresetField colors out into real scope assignments — identical to what PresetPicker's applyPreset() does for a built-in preset. */
export function fieldsToAssignments(fields: Record<PresetField, string>): Map<string, string> {
  const assignments = new Map<string, string>();
  for (const { field, scopes } of Object.values(ROLE_SCOPES)) {
    const color = fields[field];
    for (const scope of scopes) assignments.set(scope, color);
  }
  return assignments;
}

/** "sunset-harbor.jpg" → "Sunset Harbor" — falls back to a generic name for anything that leaves no usable words (no extension, all-punctuation filename, ...). */
export function suggestedNameFromFile(file: File): string {
  const base = file.name.replace(/\.[^./\\]+$/, '');
  const words = base
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return 'Photo Theme';
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Assembles a resolved core palette into the exact shape every other import source produces — see ImportedTheme. No parallel "photo theme" data shape, no special-casing downstream. */
export function buildImageTheme(name: string, core: Record<CoreField, string>, mode: ThemeMode): ImportedTheme {
  const { background, text, fields } = deriveTheme(core);
  return {
    name,
    variants: [{ mode, chrome: { background, foreground: text }, assignments: fieldsToAssignments(fields) }],
  };
}
