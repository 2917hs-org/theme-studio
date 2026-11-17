import { DEFAULT_BRIEF, normalizeBrief, type ThemeBrief } from './brief';
import type { InterpretResult, PromptInterpreter } from './interpretPrompt';

// "Layer 1": a fixed vocabulary of intents, matched with plain regexes. It
// can't understand arbitrary phrasing — the point is that what it *does*
// recognize is free, offline, deterministic, and explainable (the dialog
// shows which words were picked up). Every pattern is a bounded alternation
// of literals with no nested quantifiers, so there is no catastrophic
// backtracking on adversarial input.

type Draft = ThemeBrief & { hueSet: boolean };

interface Rule {
  label: string;
  pattern: RegExp;
  apply: (draft: Draft) => void;
}

const lowerBy = (draft: Draft, max: number) => {
  draft.contrast.max = Math.min(draft.contrast.max, max);
};
const capSaturation = (draft: Draft, max: number) => {
  draft.saturation = Math.min(draft.saturation, max);
};
const setHue = (draft: Draft, hue: number, warmth?: number) => {
  // First color word wins ("green and blue" is green) — later ones don't override it.
  if (draft.hueSet) return;
  draft.hue = hue;
  draft.hueSet = true;
  if (warmth !== undefined) draft.warmth = warmth;
};

// Mode, depth, and general style rules.
const STYLE_RULES: Rule[] = [
  {
    label: 'dark',
    pattern: /\b(dark|night|midnight|dusk|dim|oled|amoled|nocturnal|late night)\b/,
    apply: (d) => {
      d.mode = 'dark';
    },
  },
  {
    label: 'light',
    pattern: /\b(light (mode|theme|screens?|background|bg|editor)|(white|paper|daylight|day ?time|sunny|office) (mode|theme|screens?|background|bg)|paper|daylight|sunlit)\b/,
    apply: (d) => {
      d.mode = 'light';
    },
  },
  {
    label: 'deep black',
    pattern: /\b(oled|amoled|pitch|pure black|true black)\b/,
    apply: (d) => {
      d.mode = 'dark';
      d.depth = 0.05;
    },
  },
  {
    label: 'deep background',
    pattern: /\b(midnight|deep|abyss|abyssal)\b/,
    apply: (d) => {
      d.depth = Math.min(d.depth, 0.3);
    },
  },
  {
    label: 'soft background',
    pattern: /\b(charcoal|graphite|soft dark|dark gr[ae]y|off white|cream)\b/,
    apply: (d) => {
      d.depth = 0.9;
    },
  },
  {
    label: 'eye comfort',
    pattern:
      /\b((low|less|reduced?|minimal|no|without|reduce|reduces|reducing) (eye )?(stress|strain|fatigue)|(stress|strain|fatigue) (on|for|to) (the |my |your )?eyes?|eyes? (strain|stress|fatigue|comfort|friendly|care|saver|safe|health)|(easy|gentle|kind|soft|comfortable) (on|for|to) (the |my |your )?eyes?|eye ?friendly|comfortable|restful|relax(ing|ed)?|soothing|long (hours|sessions)|many hours|all ?nighter|marathon)\b/,
    apply: (d) => {
      lowerBy(d, 8);
      capSaturation(d, 0.4);
      d.depth = Math.max(d.depth, 0.8);
      d.warmth = Math.max(d.warmth, 0.5);
    },
  },
  {
    label: 'blue light',
    pattern: /\b(bluelight|night shift|f lux|flux)\b/,
    apply: (d) => {
      d.warmth = Math.max(d.warmth, 0.85);
      capSaturation(d, 0.45);
    },
  },
  {
    label: 'calm',
    pattern: /\b(calm(ing)?|soft|gentle|cozy|quiet|mellow|serene|peaceful|tranquil|smooth|easy)\b/,
    apply: (d) => {
      lowerBy(d, 8.5);
      capSaturation(d, 0.45);
      d.spread = Math.min(d.spread, 0.55);
    },
  },
  {
    label: 'low contrast',
    pattern: /\b(low contrast|subdued|faded|washed out|dimmed)\b/,
    apply: (d) => {
      lowerBy(d, 6.5);
    },
  },
  {
    label: 'high contrast',
    pattern: /\b(high contrast|crisp|sharp|accessib\w*|wcag|aaa|low vision|visually impaired)\b/,
    apply: (d) => {
      d.contrast.min = Math.max(d.contrast.min, 7);
      d.contrast.max = Math.max(d.contrast.max, 15);
      d.depth = Math.min(d.depth, 0.4);
    },
  },
  {
    label: 'readable',
    pattern: /\b(readab\w*|legib\w*|clear|clarity)\b/,
    apply: (d) => {
      d.contrast.min = Math.max(d.contrast.min, 6);
    },
  },
  {
    label: 'muted',
    pattern: /\b(muted|subtle|understated|minimal(ist)?|desaturated|clean|restrained|monochrom\w*)\b/,
    apply: (d) => {
      d.saturation = Math.min(d.saturation, 0.25);
      d.spread = Math.min(d.spread, 0.4);
    },
  },
  {
    label: 'pastel',
    pattern: /\b(pastel|candy|macaron)\b/,
    apply: (d) => {
      d.saturation = 0.38;
      d.depth = Math.max(d.depth, 0.8);
    },
  },
  {
    label: 'vibrant',
    pattern: /\b(vibrant|vivid|neon|colou?rful|saturated|punchy|electric|cyberpunk|synthwave|vaporwave|bold)\b/,
    apply: (d) => {
      d.saturation = 0.85;
      d.spread = 0.95;
      d.contrast.max = Math.max(d.contrast.max, 12);
    },
  },
  {
    label: 'warm',
    pattern: /\b(warm|cozy|candle|fireplace|hearth|toasty)\b/,
    apply: (d) => {
      d.warmth = Math.max(d.warmth, 0.8);
    },
  },
  {
    label: 'cool',
    pattern: /\b(cool|cold|chilly|icy|frosty|frost|arctic|glacier)\b/,
    apply: (d) => {
      d.warmth = Math.min(d.warmth, -0.7);
    },
  },
];

// Color and mood words — each sets the anchor hue (first one wins) and can
// bias warmth or saturation the way the word itself would suggest.
const COLOR_RULES: Rule[] = [
  { label: 'red', pattern: /\b(red|crimson|scarlet|ruby|cherry)\b/, apply: (d) => setHue(d, 5, 0.3) },
  { label: 'pink', pattern: /\b(pink|rose|blush|magenta|fuchsia|sakura)\b/, apply: (d) => setHue(d, 335, 0.2) },
  {
    label: 'purple',
    pattern: /\b(purple|violet|lavender|lilac|amethyst|plum|grape)\b/,
    apply: (d) => setHue(d, 270),
  },
  { label: 'indigo', pattern: /\b(indigo)\b/, apply: (d) => setHue(d, 245) },
  { label: 'blue', pattern: /\b(blue|navy|sapphire|cobalt|azure|sky)\b/, apply: (d) => setHue(d, 218) },
  {
    label: 'ocean',
    pattern: /\b(ocean|sea|marine|lagoon|arctic|glacier|ice|icy|frost\w*)\b/,
    apply: (d) => setHue(d, 200, -0.5),
  },
  { label: 'teal', pattern: /\b(teal|cyan|aqua|turquoise)\b/, apply: (d) => setHue(d, 180) },
  { label: 'mint', pattern: /\b(mint|seafoam|pistachio)\b/, apply: (d) => setHue(d, 160) },
  {
    label: 'forest',
    pattern: /\b(forest|jungle|moss|sage|nature|woods|woodland|fern|pine)\b/,
    apply: (d) => {
      setHue(d, 140);
      capSaturation(d, 0.5);
    },
  },
  { label: 'green', pattern: /\b(green|emerald|olive|matcha)\b/, apply: (d) => setHue(d, 135) },
  { label: 'lime', pattern: /\b(lime|chartreuse)\b/, apply: (d) => setHue(d, 90) },
  { label: 'yellow', pattern: /\b(yellow|gold|golden|lemon|banana)\b/, apply: (d) => setHue(d, 50, 0.5) },
  { label: 'amber', pattern: /\b(amber|honey|marigold)\b/, apply: (d) => setHue(d, 38, 0.7) },
  {
    label: 'orange',
    pattern: /\b(orange|tangerine|sunset|sunrise|ember|embers|fire|autumn|pumpkin)\b/,
    apply: (d) => setHue(d, 25, 0.7),
  },
  {
    label: 'earth',
    pattern: /\b(brown|coffee|chocolate|mocha|sepia|earth|earthy|desert|sand|wood|terracotta|espresso|latte)\b/,
    apply: (d) => {
      setHue(d, 28, 0.8);
      capSaturation(d, 0.5);
    },
  },
  {
    label: 'grey',
    pattern: /\b(gr[ae]y|slate|graphite|steel|neutral|ash|stone)\b/,
    apply: (d) => {
      setHue(d, 215, 0);
      d.saturation = Math.min(d.saturation, 0.22);
      d.spread = Math.min(d.spread, 0.4);
    },
  },
];

const ALL_RULES = [...STYLE_RULES, ...COLOR_RULES];

/** Lowercases, strips punctuation, and rewrites negated phrases ("not too bright") into the positive intent they mean, so "bright" doesn't flip the theme to light. */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(not|never|no|without|nothing|avoid|dont|dont want( it| things| the theme)?)\s+(too |so |very |overly |really )?(colou?rful|neon|saturated|vivid|loud|flashy|busy|garish)\b/g, ' muted ')
    .replace(/\b(not|never|no|without|nothing|avoid|dont|dont want( it| things| the theme)?)\s+(too |so |very |overly |really )?(bright|harsh|glaring|glare|contrasty|intense|blinding)\b/g, ' soft ')
    .replace(/\banti ?glare\b/g, ' soft ')
    // "Blue light" / "less blue" is about eye comfort, not a request for blue — collapse it to one token so the color rule for "blue" can't claim it.
    .replace(/\b(blue light|(less|no|reduce|reduced|reduces|avoid|without|minimal|low|cut) blue)\b/g, ' bluelight ')
    .replace(/\s+/g, ' ')
    .trim();
}

function interpretSync(prompt: string): InterpretResult {
  const text = normalizePrompt(prompt);
  if (!text) return { ok: false, reason: 'empty' };

  const hits = ALL_RULES.flatMap((rule) => {
    const match = rule.pattern.exec(text);
    return match ? [{ rule, index: match.index }] : [];
  });
  if (hits.length === 0) return { ok: false, reason: 'unrecognized' };

  // Apply in the order words appear, so when two intents conflict ("vibrant
  // ... but soft") the one mentioned last wins for the fields it sets.
  hits.sort((a, b) => a.index - b.index);

  const draft: Draft = { ...DEFAULT_BRIEF, contrast: { ...DEFAULT_BRIEF.contrast }, hueSet: false };
  for (const { rule } of hits) rule.apply(draft);

  // No color word: let warmth decide the anchor hue (warm → amber, cool →
  // blue) instead of always landing on the same default blue.
  if (!draft.hueSet) {
    if (draft.warmth >= 0.3) draft.hue = 32;
    else if (draft.warmth <= -0.3) draft.hue = 205;
  }

  return {
    ok: true,
    brief: normalizeBrief({
      mode: draft.mode,
      hue: draft.hue,
      warmth: draft.warmth,
      depth: draft.depth,
      contrast: draft.contrast,
      saturation: draft.saturation,
      spread: draft.spread,
    }),
    matched: hits.map(({ rule }) => rule.label),
    interpreter: 'rules',
  };
}

export const ruleBasedInterpreter: PromptInterpreter = {
  id: 'rules',
  interpret: async (prompt) => interpretSync(prompt),
};
