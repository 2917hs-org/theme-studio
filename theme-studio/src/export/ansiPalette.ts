import { hexToRgb, rgbToHex, hexToHsv, hsvToHex, relativeLuminance } from '../theme/colorParse';

export interface AnsiPalette {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

type HueName = 'red' | 'yellow' | 'green' | 'cyan' | 'blue' | 'magenta';

const HUE_TARGETS: Record<HueName, number> = { red: 0, yellow: 60, green: 120, cyan: 180, blue: 240, magenta: 300 };

// How far (in hue degrees) an accent color is allowed to sit from a named
// ANSI slot's target hue and still stand in for it. Past this, a
// synthesized fallback reads truer to the slot's name than forcing, say, a
// theme's teal into "blue".
const HUE_MATCH_THRESHOLD_DEG = 40;

// A near-gray accent (low saturation) makes a poor stand-in for any named
// hue — it would "match" whichever target happens to be numerically
// closest by pure chance, not because it actually reads as that color.
const MIN_SATURATION_FOR_HUE_MATCH = 0.12;

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function blend(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** ANSI "bright" variants are, by convention, literally brighter than their base slot — same hue, a bit less saturated, meaningfully higher value. */
function brighten(hex: string): string {
  const { h, s, v } = hexToHsv(hex);
  return hsvToHex(h, Math.max(0, s - 0.08), Math.min(1, v + 0.18));
}

/** Used only when no accent color in the theme sits close enough to a hue slot — keeps every export usable even for a theme that never touched, say, purple. Tuned by the background's luminance: vivid reads well on a dark background, a deeper tone reads better against a light one. */
function fallbackForHue(hueDeg: number, backgroundLuminance: number): string {
  const dark = backgroundLuminance < 0.5;
  return hsvToHex(hueDeg, dark ? 0.6 : 0.68, dark ? 0.82 : 0.55);
}

/**
 * Derives a full 16-color ANSI terminal palette from whatever a theme
 * actually defines: `background`/`foreground` anchor black/white, and
 * `accents` (however many accent colors the theme happens to have — see
 * extractBaseRoles) get hue-matched onto the six named color slots.
 */
export function deriveAnsiPalette(background: string, foreground: string, accents: string[]): AnsiPalette {
  const bgLum = relativeLuminance(background);
  const fgLum = relativeLuminance(foreground);
  const darkAnchor = bgLum <= fgLum ? background : foreground;
  const lightAnchor = bgLum <= fgLum ? foreground : background;

  const candidates = accents.map(hexToHsv);

  function resolve(name: HueName): string {
    const target = HUE_TARGETS[name];
    let best: { h: number; s: number; v: number } | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (c.s < MIN_SATURATION_FOR_HUE_MATCH) continue;
      const d = hueDistance(c.h, target);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best && bestDist <= HUE_MATCH_THRESHOLD_DEG) return hsvToHex(best.h, best.s, best.v);
    return fallbackForHue(target, bgLum);
  }

  const red = resolve('red');
  const green = resolve('green');
  const yellow = resolve('yellow');
  const blue = resolve('blue');
  const magenta = resolve('magenta');
  const cyan = resolve('cyan');

  return {
    black: darkAnchor,
    white: lightAnchor,
    brightBlack: blend(darkAnchor, lightAnchor, 0.35),
    brightWhite: blend(lightAnchor, '#ffffff', 0.4),
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    brightRed: brighten(red),
    brightGreen: brighten(green),
    brightYellow: brighten(yellow),
    brightBlue: brighten(blue),
    brightMagenta: brighten(magenta),
    brightCyan: brighten(cyan),
  };
}
