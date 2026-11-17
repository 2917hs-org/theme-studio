import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToHsv } from '../colorParse';
import { ROLE_SCOPES } from '../presetPalette';
import { DEFAULT_BRIEF, normalizeBrief, type ThemeBrief } from './brief';
import { generateTheme, generateVariants } from './generateTheme';
import { interpretPrompt } from './interpretPrompt';

const HEX = /^#[0-9a-f]{6}$/;

function brief(partial: Partial<Omit<ThemeBrief, 'contrast'>> & { contrast?: Partial<ThemeBrief['contrast']> } = {}) {
  return normalizeBrief({ ...DEFAULT_BRIEF, ...partial, contrast: { ...DEFAULT_BRIEF.contrast, ...partial.contrast } });
}

describe('generateTheme', () => {
  it('produces a valid hex for every palette field and an assignment for every scope', () => {
    const t = generateTheme(brief());
    for (const color of Object.values(t.palette)) expect(color).toMatch(HEX);
    const [variant] = t.theme.variants;
    for (const { scopes } of Object.values(ROLE_SCOPES)) for (const scope of scopes) expect(variant.assignments.has(scope)).toBe(true);
    expect(variant.chrome).toEqual({ background: t.background, foreground: t.text });
  });

  it('is deterministic', () => {
    expect(generateTheme(brief({ hue: 140 }))).toEqual(generateTheme(brief({ hue: 140 })));
  });

  const grid: Array<[string, ThemeBrief]> = [];
  for (const mode of ['dark', 'light'] as const)
    for (const hue of [0, 60, 120, 180, 230, 300])
      for (const saturation of [0.1, 0.55, 1])
        for (const [min, max] of [[4.5, 7], [4.5, 10], [7, 15]])
          grid.push([`${mode} hue=${hue} sat=${saturation} ${min}-${max}`, brief({ mode, hue, saturation, warmth: hue === 230 ? 0.9 : 0, contrast: { min, max } })]);

  it.each(grid)('keeps every syntax color readable: %s', (_label, b) => {
    const t = generateTheme(b);
    expect(t.lowestContrast).toBeGreaterThanOrEqual(b.contrast.min - 0.15);
    // Text never exceeds the ceiling by more than rounding error — that's the "no glare" guarantee.
    expect(t.textContrast).toBeLessThanOrEqual(b.contrast.max + 0.3);
  });

  it('keeps comments dimmer than text but still visible', () => {
    const t = generateTheme(brief());
    const comments = contrastRatio(t.palette.comments, t.background);
    expect(comments).toBeGreaterThan(2.5);
    expect(comments).toBeLessThan(t.textContrast);
  });

  it('honors mode: dark backgrounds are dark, light are light', () => {
    expect(hexToHsv(generateTheme(brief({ mode: 'dark' })).background).v).toBeLessThan(0.3);
    expect(hexToHsv(generateTheme(brief({ mode: 'light' })).background).v).toBeGreaterThan(0.85);
  });

  it('a softer brief yields strictly less text contrast than a high-contrast one', () => {
    expect(generateTheme(brief({ contrast: { min: 4.5, max: 7 } })).textContrast).toBeLessThan(generateTheme(brief({ contrast: { min: 7, max: 15 } })).textContrast);
  });

  it('keeps accents distinguishable even for a narrow palette', () => {
    const t = generateTheme(brief({ spread: 0.2 }));
    const distinct = new Set([t.palette.keywords, t.palette.strings, t.palette.functions, t.palette.types, t.palette.numbers]);
    expect(distinct.size).toBe(5);
  });

  it('end to end: the motivating prompt yields a soft, warm, dark theme', async () => {
    const result = await interpretPrompt('Generate a theme that will look good on dark screen with low stress on eyes');
    if (!result.ok) throw new Error('unrecognized');
    const t = generateTheme(result.brief);
    expect(t.mode).toBe('dark');
    expect(t.textContrast).toBeLessThanOrEqual(8.3);
    expect(t.lowestContrast).toBeGreaterThanOrEqual(4.3);
    // Not pure black, and the text isn't pure white.
    expect(t.background).not.toBe('#000000');
    expect(t.text).not.toBe('#ffffff');
    // Warm: the background tint sits on the red-yellow side of the wheel.
    const hue = hexToHsv(t.background).h;
    expect(hue < 90 || hue > 330).toBe(true);
  });
});

describe('generateVariants', () => {
  it('returns three distinct, uniquely named options that all honor the brief', () => {
    const b = brief({ mode: 'light', contrast: { min: 4.5, max: 8 } });
    const options = generateVariants(b);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((o) => o.name)).size).toBe(3);
    expect(new Set(options.map((o) => o.background)).size).toBe(3);
    for (const o of options) {
      expect(o.mode).toBe('light');
      expect(o.textContrast).toBeLessThanOrEqual(8.3);
      expect(o.lowestContrast).toBeGreaterThanOrEqual(4.35);
      expect(o.theme.name).toBe(o.name);
    }
  });

  it('keeps the first option identical to the brief taken literally, and is deterministic', () => {
    const b = brief({ hue: 140 });
    expect(generateVariants(b)[0]).toEqual(generateTheme(b));
    expect(generateVariants(b)).toEqual(generateVariants(b));
  });
});
