import { describe, expect, it } from 'vitest';
import { interpretPrompt, MAX_PROMPT_LENGTH, type PromptInterpreter } from './interpretPrompt';
import { normalizePrompt } from './ruleInterpreter';
import { BRIEF_LIMITS, normalizeBrief } from './brief';

async function brief(prompt: string) {
  const result = await interpretPrompt(prompt);
  if (!result.ok) throw new Error(`expected "${prompt}" to be recognized, got ${result.reason}`);
  return result.brief;
}

describe('interpretPrompt (rule-based)', () => {
  it('reads the motivating prompt: dark, low eye strain', async () => {
    const result = await interpretPrompt('Generate a theme that will look good on dark screen with low stress on eyes');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.interpreter).toBe('rules');
    expect(result.matched).toEqual(expect.arrayContaining(['dark', 'eye comfort']));
    expect(result.brief.mode).toBe('dark');
    // Soft ceiling, muted accents, warm — the "low strain" levers.
    expect(result.brief.contrast.max).toBeLessThanOrEqual(8);
    expect(result.brief.saturation).toBeLessThanOrEqual(0.4);
    expect(result.brief.warmth).toBeGreaterThanOrEqual(0.5);
  });

  it('never goes below the readability floor, whatever the prompt says', async () => {
    const b = await brief('very low contrast dim subdued dark theme');
    expect(b.contrast.min).toBeGreaterThanOrEqual(BRIEF_LIMITS.minContrast);
  });

  it('returns typed failures instead of throwing', async () => {
    expect(await interpretPrompt('')).toEqual({ ok: false, reason: 'empty' });
    expect(await interpretPrompt('   \n ')).toEqual({ ok: false, reason: 'empty' });
    expect(await interpretPrompt('xyzzy plugh')).toEqual({ ok: false, reason: 'unrecognized' });
  });

  it('picks the light mode only on explicit light-mode wording', async () => {
    expect((await brief('a light theme for daytime')).mode).toBe('light');
    expect((await brief('a theme with a white background')).mode).toBe('light');
    expect((await brief('dark theme with white text')).mode).toBe('dark');
  });

  it('treats negated intensity as soft, not as its opposite', async () => {
    const b = await brief('dark theme, not too bright');
    expect(b.mode).toBe('dark');
    expect(b.contrast.max).toBeLessThanOrEqual(8.5);
    expect(normalizePrompt("Don't want it too colorful")).not.toContain('colorful');
  });

  it('does not read "less blue light" as a request for blue', async () => {
    const b = await brief('dark theme with less blue light');
    expect(b.warmth).toBeGreaterThanOrEqual(0.8);
    expect(b.hue).toBeLessThan(60); // amber side, not 218 (blue)
  });

  it('maps color and mood words to an anchor hue', async () => {
    expect((await brief('dark forest vibes')).hue).toBe(140);
    expect((await brief('deep ocean')).hue).toBe(200);
    expect((await brief('cozy coffee shop')).hue).toBe(28);
  });

  it('lets the first color word win', async () => {
    expect((await brief('dark green and blue')).hue).toBe(135);
  });

  it('lets the later of two conflicting intents win', async () => {
    const b = await brief('vibrant but calm');
    expect(b.contrast.max).toBeLessThanOrEqual(8.5);
    expect(b.saturation).toBeLessThanOrEqual(0.45);
  });

  it('applies high contrast for accessibility wording', async () => {
    const b = await brief('accessible high contrast dark theme');
    expect(b.contrast.min).toBeGreaterThanOrEqual(7);
    expect(b.contrast.max).toBeGreaterThanOrEqual(15);
  });

  it('truncates over-long prompts instead of failing', async () => {
    const result = await interpretPrompt(`dark ${'x '.repeat(MAX_PROMPT_LENGTH)}`);
    expect(result.ok).toBe(true);
  });

  it('is fast on adversarial input (no regex backtracking)', async () => {
    const start = performance.now();
    await interpretPrompt('not '.repeat(MAX_PROMPT_LENGTH / 4) + 'dark');
    await interpretPrompt('a'.repeat(MAX_PROMPT_LENGTH));
    expect(performance.now() - start).toBeLessThan(200);
  });

  it('is swappable: a custom interpreter replaces the rules without touching callers', async () => {
    const fake: PromptInterpreter = {
      id: 'fake',
      interpret: async () => ({ ok: true, brief: normalizeBrief({ mode: 'light' }), matched: ['fake'], interpreter: 'fake' }),
    };
    const result = await interpretPrompt('anything', { interpreter: fake });
    expect(result.ok && result.interpreter).toBe('fake');
  });
});

describe('normalizeBrief', () => {
  it('clamps garbage into the valid range', () => {
    const b = normalizeBrief({ hue: -90, warmth: 9, depth: -1, saturation: NaN, spread: 50, contrast: { min: 1, max: 2 } });
    expect(b.hue).toBe(270);
    expect(b.warmth).toBe(1);
    expect(b.depth).toBe(0);
    expect(b.saturation).toBeGreaterThan(0);
    expect(b.spread).toBe(1);
    expect(b.contrast.min).toBe(BRIEF_LIMITS.minContrast);
    expect(b.contrast.max).toBeGreaterThan(b.contrast.min);
  });
});
