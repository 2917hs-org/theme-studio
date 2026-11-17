import type { ThemeMode } from '../mode';

/**
 * What a prompt *means*, as numbers — the contract between "understanding
 * a prompt" (any `PromptInterpreter`) and "building a theme" (generateTheme).
 * An interpreter never picks colors; it only fills this in, and the
 * generator turns it into a theme that is valid by construction.
 */
export interface ThemeBrief {
  mode: ThemeMode;
  /** Anchor hue, 0-360 — tints the background and starts the accent wheel. */
  hue: number;
  /** Cool (-1) to warm (+1). Pulls accent hues toward amber/blue and tames saturated blues when warm (the "low eye strain" lever). */
  warmth: number;
  /** 0 = as far from the text color as possible (pure black / white), 1 = softest (charcoal / off-white). */
  depth: number;
  /** WCAG contrast range for code text. `min` is the readability floor; `max` is the ceiling that keeps text from glaring. */
  contrast: { min: number; max: number };
  /** Accent saturation, 0-1. */
  saturation: number;
  /** How far apart accent hues sit, 0-1. Low = analogous and calm; high = full color wheel. */
  spread: number;
}

/** Hard bounds every brief is clamped to, so no interpreter (rules or a future LLM) can ask for an unreadable theme. */
export const BRIEF_LIMITS = {
  /** Readability floor — the WCAG AA bar for normal text. A brief can never go below it. */
  minContrast: 4.5,
  maxContrast: 21,
  saturation: { min: 0.08, max: 1 },
  spread: { min: 0.2, max: 1 },
} as const;

export const DEFAULT_BRIEF: ThemeBrief = {
  mode: 'dark',
  hue: 220,
  warmth: 0,
  depth: 0.7,
  contrast: { min: 4.5, max: 10 },
  saturation: 0.55,
  spread: 0.7,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const finiteOr = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);

/** Forces any (possibly partial or garbage) brief into the valid range — the one gate between an interpreter's output and the generator. */
export function normalizeBrief(input: Partial<Omit<ThemeBrief, 'contrast'>> & { contrast?: Partial<ThemeBrief['contrast']> }): ThemeBrief {
  const d = DEFAULT_BRIEF;
  const min = clamp(finiteOr(input.contrast?.min, d.contrast.min), BRIEF_LIMITS.minContrast, 12);
  const max = clamp(finiteOr(input.contrast?.max, d.contrast.max), min + 0.5, BRIEF_LIMITS.maxContrast);
  return {
    mode: input.mode === 'light' ? 'light' : 'dark',
    hue: ((finiteOr(input.hue, d.hue) % 360) + 360) % 360,
    warmth: clamp(finiteOr(input.warmth, d.warmth), -1, 1),
    depth: clamp(finiteOr(input.depth, d.depth), 0, 1),
    contrast: { min, max },
    saturation: clamp(finiteOr(input.saturation, d.saturation), BRIEF_LIMITS.saturation.min, BRIEF_LIMITS.saturation.max),
    spread: clamp(finiteOr(input.spread, d.spread), BRIEF_LIMITS.spread.min, BRIEF_LIMITS.spread.max),
  };
}

/** Plain-language read-back of a brief — shown to the user so they can see how their prompt was understood. */
export function describeBrief(brief: ThemeBrief): string[] {
  const { min, max } = brief.contrast;
  const out: string[] = [`${brief.mode} mode`];
  if (max <= 8.5) out.push(`soft contrast (${min.toFixed(1)}–${max.toFixed(1)}:1)`);
  else if (min >= 7) out.push(`high contrast (${min.toFixed(1)}–${max.toFixed(1)}:1)`);
  else out.push(`balanced contrast (${min.toFixed(1)}–${max.toFixed(1)}:1)`);
  if (brief.saturation <= 0.32) out.push('muted colors');
  else if (brief.saturation >= 0.7) out.push('vivid colors');
  else out.push('moderate colors');
  if (brief.warmth >= 0.3) out.push('warm tones');
  else if (brief.warmth <= -0.3) out.push('cool tones');
  if (brief.spread <= 0.4) out.push('narrow palette');
  return out;
}
