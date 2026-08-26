import type { ThemeMode } from './mode';

// Every field here is one authored color a preset actually picks — see
// presetPalette.ts for how these ~20 colors expand into ~160 real scope
// assignments (the same "small palette, reused across many scopes" shape a
// published theme has). The five original fields (comments/keywords/
// strings/functions/numbers) keep their original names and values; every
// other field is new.
export interface ThemePreset {
  id: string;
  name: string;
  mode: ThemeMode;
  background: string;
  text: string;
  comments: string;
  keywords: string;
  strings: string;
  functions: string;
  numbers: string;
  stringEscape: string;
  regexp: string;
  constants: string;
  storage: string;
  punctuation: string;
  functionsBuiltin: string;
  types: string;
  typesBuiltin: string;
  variables: string;
  variablesProperty: string;
  tags: string;
  tagsAttribute: string;
  markup: string;
  diffInserted: string;
  diffDeleted: string;
  diffChanged: string;
  invalid: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-navy',
    name: 'Dark Navy',
    mode: 'dark',
    background: '#0f172a',
    text: '#e2e8f0',
    comments: '#94a3b8',
    keywords: '#c084fc',
    strings: '#86efac',
    functions: '#60a5fa',
    numbers: '#fbbf24',
    stringEscape: '#f472b6',
    regexp: '#f87171',
    constants: '#fbbf24',
    storage: '#c084fc',
    punctuation: '#94a3b8',
    functionsBuiltin: '#38bdf8',
    types: '#5eead4',
    typesBuiltin: '#2dd4bf',
    variables: '#e2e8f0',
    variablesProperty: '#93c5fd',
    tags: '#fb7185',
    tagsAttribute: '#fbbf24',
    markup: '#c084fc',
    diffInserted: '#4ade80',
    diffDeleted: '#f87171',
    diffChanged: '#fbbf24',
    invalid: '#f87171',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    background: '#0a0f19',
    text: '#dbeafe',
    comments: '#7e97b4',
    keywords: '#facc15',
    strings: '#4ade80',
    functions: '#60a5fa',
    numbers: '#fb923c',
    stringEscape: '#38bdf8',
    regexp: '#f87171',
    constants: '#fb923c',
    storage: '#facc15',
    punctuation: '#7e97b4',
    functionsBuiltin: '#7dd3fc',
    types: '#c4b5fd',
    typesBuiltin: '#a78bfa',
    variables: '#dbeafe',
    variablesProperty: '#93c5fd',
    tags: '#fb7185',
    tagsAttribute: '#facc15',
    markup: '#facc15',
    diffInserted: '#4ade80',
    diffDeleted: '#f87171',
    diffChanged: '#fb923c',
    invalid: '#f87171',
  },
  {
    id: 'soft-light',
    name: 'Soft Light',
    mode: 'light',
    background: '#f8fafc',
    text: '#1e293b',
    comments: '#64748b',
    keywords: '#7c3aed',
    strings: '#166534',
    functions: '#2563eb',
    numbers: '#c2410c',
    stringEscape: '#be185d',
    regexp: '#b91c1c',
    constants: '#c2410c',
    storage: '#7c3aed',
    punctuation: '#64748b',
    functionsBuiltin: '#0369a1',
    types: '#0f766e',
    typesBuiltin: '#0d9488',
    variables: '#1e293b',
    variablesProperty: '#1d4ed8',
    tags: '#be123c',
    tagsAttribute: '#a16207',
    markup: '#7c3aed',
    diffInserted: '#15803d',
    diffDeleted: '#b91c1c',
    diffChanged: '#a16207',
    invalid: '#b91c1c',
  },
  {
    id: 'sandstone-light',
    name: 'Sandstone Light',
    mode: 'light',
    background: '#fbf7f0',
    text: '#2b2320',
    comments: '#7a6f60',
    keywords: '#b34700',
    strings: '#2f6f4e',
    functions: '#1d5c9e',
    numbers: '#8a4b00',
    stringEscape: '#9d3b6b',
    regexp: '#a3321c',
    constants: '#8a4b00',
    storage: '#b34700',
    punctuation: '#7a6f60',
    functionsBuiltin: '#164e7a',
    types: '#4d6b53',
    typesBuiltin: '#3d5744',
    variables: '#2b2320',
    variablesProperty: '#1d5c9e',
    tags: '#8a2f1f',
    tagsAttribute: '#8a4b00',
    markup: '#b34700',
    diffInserted: '#2f6f4e',
    diffDeleted: '#a3321c',
    diffChanged: '#8a4b00',
    invalid: '#a3321c',
  },
];

/** The scope each preset field maps onto — broad top-level TextMate families so every sub-variant (e.g. every comment style) inherits it. Used for quick single-scope lookups (e.g. the preset swatch dots, a Marketplace result preview) — the full expansion (~160 scopes) lives in presetPalette.ts's ROLE_SCOPES. */
export const PRESET_SCOPES = {
  comments: 'comment',
  keywords: 'keyword',
  strings: 'string',
  functions: 'entity.name.function',
  numbers: 'constant.numeric',
} as const;
