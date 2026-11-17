import { contrastRatio, hsvToHex } from '../colorParse';
import type { ImportedTheme } from '../importTheme';
import type { ThemeMode } from '../mode';
import { expandPalette, type PresetField } from '../presetPalette';
import { normalizeBrief, type ThemeBrief } from './brief';

export interface GeneratedTheme {
  name: string;
  mode: ThemeMode;
  background: string;
  text: string;
  /** One color per PresetField — the same shape a hand-authored preset has. */
  palette: Record<PresetField, string>;
  /** Ready for `importTheme`. */
  theme: ImportedTheme;
  /** Measured, not assumed: the worst contrast among text and syntax accents (comments excluded — they're intentionally dim). */
  lowestContrast: number;
  textContrast: number;
}

const wrapHue = (h: number) => ((h % 360) + 360) % 360;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Signed shortest rotation from hue `a` to hue `b`, in degrees. */
function hueDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/**
 * Warm briefs pull every accent part-way toward amber, cool ones toward blue —
 * a nudge, not a replacement, so accents stay distinguishable from each other.
 */
function biasHue(hue: number, warmth: number): number {
  if (warmth === 0) return hue;
  const target = warmth > 0 ? 35 : 215;
  return wrapHue(hue + hueDelta(hue, target) * Math.abs(warmth) * 0.25);
}

/** Saturated blue/cyan is the harshest on the eyes at night — tame it in proportion to how warm the brief is. */
function eyeSafeSaturation(hue: number, saturation: number, warmth: number): number {
  if (warmth <= 0) return saturation;
  const closeness = Math.max(0, 1 - Math.abs(hueDelta(hue, 230)) / 45);
  return saturation * (1 - 0.5 * warmth * closeness);
}

/**
 * Picks the brightness (HSV value) at which a hue/saturation lands on
 * `target` contrast against `background`. Contrast rises monotonically as the
 * color moves away from the background (lighter on dark, darker on light), so
 * bisection is exact. If the hue can't reach it at any brightness, saturation
 * is reduced until it can.
 */
function colorAtContrast(hue: number, saturation: number, background: string, backgroundValue: number, mode: ThemeMode, target: number): string {
  let near = backgroundValue; // end closest to the background
  const far = mode === 'dark' ? 1 : 0; // end furthest from it
  let sat = saturation;
  if (contrastRatio(hsvToHex(hue, sat, far), background) < target) {
    // Some hues (saturated blue, purple) are too dark to reach the target
    // even at full brightness. Mixing in white raises luminance without
    // changing hue, so back off saturation just enough to land on it —
    // the readability floor outranks the requested vividness.
    let lo = 0;
    let hi = sat;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(hsvToHex(hue, mid, far), background) >= target) lo = mid;
      else hi = mid;
    }
    sat = lo;
    return hsvToHex(hue, sat, far);
  }
  let farEnd = far;
  for (let i = 0; i < 24; i++) {
    const mid = (near + farEnd) / 2;
    if (contrastRatio(hsvToHex(hue, sat, mid), background) < target) near = mid;
    else farEnd = mid;
  }
  return hsvToHex(hue, sat, farEnd);
}

type AccentField = Exclude<PresetField, 'text' | 'comments' | 'punctuation' | 'variables' | 'diffInserted' | 'diffDeleted' | 'diffChanged' | 'invalid'>;

// Where each syntax color sits on the accent wheel (`at`, 0-1 of the brief's
// hue spread), how saturated it is relative to the brief (`sat`), and where
// in the contrast range it lands (`level`, 0 = the floor, 1 = the ceiling).
// Varying `level` as well as hue is what keeps accents distinguishable when
// a calm brief squeezes the hues close together.
const ACCENT_SLOTS: Record<AccentField, { at: number; sat: number; level: number }> = {
  keywords: { at: 0.0, sat: 1.0, level: 0.5 },
  storage: { at: 0.06, sat: 0.9, level: 0.4 },
  tags: { at: 0.1, sat: 1.0, level: 0.5 },
  variablesProperty: { at: 0.16, sat: 0.7, level: 0.7 },
  functions: { at: 0.22, sat: 1.0, level: 0.65 },
  functionsBuiltin: { at: 0.28, sat: 0.85, level: 0.55 },
  tagsAttribute: { at: 0.34, sat: 0.9, level: 0.6 },
  stringEscape: { at: 0.4, sat: 0.9, level: 0.45 },
  strings: { at: 0.45, sat: 0.95, level: 0.6 },
  regexp: { at: 0.52, sat: 1.0, level: 0.4 },
  markup: { at: 0.56, sat: 0.9, level: 0.55 },
  types: { at: 0.62, sat: 0.95, level: 0.7 },
  typesBuiltin: { at: 0.68, sat: 0.85, level: 0.5 },
  numbers: { at: 0.8, sat: 1.0, level: 0.5 },
  constants: { at: 0.88, sat: 0.95, level: 0.45 },
};

const HUE_NAMES: Array<[number, string]> = [
  [15, 'Ember'],
  [40, 'Amber'],
  [65, 'Honey'],
  [105, 'Moss'],
  [150, 'Forest'],
  [190, 'Lagoon'],
  [235, 'Ocean'],
  [265, 'Dusk'],
  [300, 'Orchid'],
  [340, 'Rose'],
  [360, 'Ember'],
];

function themeName(brief: ThemeBrief): string {
  const hueName = HUE_NAMES.find(([upTo]) => brief.hue <= upTo)?.[1] ?? 'Slate';
  const mood = brief.saturation <= 0.32 ? 'Quiet' : brief.contrast.max <= 8.5 ? 'Calm' : brief.contrast.min >= 7 ? 'Crisp' : brief.saturation >= 0.7 ? 'Vivid' : 'Studio';
  return `${mood} ${hueName} ${brief.mode === 'dark' ? 'Night' : 'Day'}`;
}

/** Builds a complete theme from a brief. Pure and deterministic: the same brief always yields the same colors. */
export function generateTheme(input: ThemeBrief): GeneratedTheme {
  const brief = normalizeBrief(input);
  const { mode, contrast, warmth } = brief;

  // Background: dark runs from near-black (depth 0) to charcoal (depth 1);
  // light from pure white to off-white. A faint tint of the anchor hue keeps it from reading as dead grey.
  const backgroundValue = mode === 'dark' ? lerp(0.04, 0.22, brief.depth) : lerp(1, 0.92, brief.depth);
  const backgroundSaturation = mode === 'dark' ? lerp(0.1, 0.3, brief.depth) : lerp(0.02, 0.07, brief.depth);
  const background = hsvToHex(brief.hue, backgroundSaturation, backgroundValue);

  const at = (hue: number, saturation: number, target: number) => colorAtContrast(hue, clamp01(saturation), background, backgroundValue, mode, target);
  const level = (t: number) => lerp(contrast.min, contrast.max, t);

  const text = at(brief.hue, 0.06, contrast.max);
  const spreadDegrees = 40 + brief.spread * 320;

  const accents = {} as Record<AccentField, string>;
  for (const [field, slot] of Object.entries(ACCENT_SLOTS) as Array<[AccentField, (typeof ACCENT_SLOTS)[AccentField]]>) {
    const hue = biasHue(wrapHue(brief.hue + slot.at * spreadDegrees), warmth);
    const saturation = eyeSafeSaturation(hue, brief.saturation * slot.sat, warmth);
    accents[field] = at(hue, saturation, level(slot.level));
  }

  // Status colors keep their meaning (green/amber/red) regardless of the anchor hue.
  const statusSaturation = Math.max(0.3, brief.saturation);
  const palette: Record<PresetField, string> = {
    ...accents,
    text,
    // Comments are deliberately the dimmest thing on screen — below the readable floor, by design, as in every real theme.
    comments: at(brief.hue, 0.18, Math.min(3.4, contrast.min - 0.5)),
    punctuation: at(brief.hue, 0.08, contrast.min),
    variables: at(brief.hue, 0.1, level(0.85)),
    diffInserted: at(135, eyeSafeSaturation(135, statusSaturation, warmth), level(0.4)),
    diffChanged: at(45, statusSaturation, level(0.4)),
    diffDeleted: at(5, statusSaturation, level(0.4)),
    invalid: at(0, Math.max(0.5, statusSaturation), level(0.55)),
  };

  const accentContrasts = Object.entries(palette)
    .filter(([field]) => field !== 'comments')
    .map(([, color]) => contrastRatio(color, background));
  const name = themeName(brief);

  return {
    name,
    mode,
    background,
    text,
    palette,
    theme: {
      name,
      variants: [{ mode, chrome: { background, foreground: text }, assignments: expandPalette(palette) }],
    },
    lowestContrast: Math.min(...accentContrasts),
    textContrast: contrastRatio(text, background),
  };
}

// How each option differs from the interpreted brief: the first is the
// prompt taken literally, the other two rotate the anchor hue and nudge how
// far apart the accents sit. Mode, contrast and saturation — the parts a
// prompt actually specifies — are never touched, so all three options honor it.
const VARIANT_SHIFTS: Array<{ hue: number; spread: number }> = [
  { hue: 0, spread: 0 },
  { hue: 60, spread: -0.15 },
  { hue: -60, spread: 0.15 },
];

const ROMAN = ['', ' II', ' III', ' IV'];

/** Several takes on one brief, so a prompt gives the user a choice instead of a single guess. Deterministic; names are made unique. */
export function generateVariants(brief: ThemeBrief, count = VARIANT_SHIFTS.length): GeneratedTheme[] {
  const base = normalizeBrief(brief);
  const seen = new Map<string, number>();
  return VARIANT_SHIFTS.slice(0, count).map((shift) => {
    const generated = generateTheme(normalizeBrief({ ...base, hue: base.hue + shift.hue, spread: base.spread + shift.spread }));
    const nth = seen.get(generated.name) ?? 0;
    seen.set(generated.name, nth + 1);
    if (nth === 0) return generated;
    const name = `${generated.name}${ROMAN[nth] ?? ` ${nth + 1}`}`;
    return { ...generated, name, theme: { ...generated.theme, name } };
  });
}
