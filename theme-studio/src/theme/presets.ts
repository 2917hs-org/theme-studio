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
  /** Who originally designed the real theme this preset is inspired by, shown in the picker's tooltip — e.g. "enkia" for Tokyo Night. Omitted for presets with no single outside author to credit. */
  author?: string;
  /** Which Quick Start grouping this preset is pitched under — drives the inline category labels PresetPicker renders between clusters of cards. */
  category: 'Best-looking' | 'Readability';
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

// Color values below are drawn from each theme's own published source (its
// VS Code extension's theme JSON), not guessed: an homage built from the
// same real colors, not a redistribution of the extension itself. See
// `author` on each entry for who actually designed it.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    author: 'enkia',
    category: 'Best-looking',
    mode: 'dark',
    background: '#1a1b26',
    text: '#a9b1d6',
    comments: '#51597d',
    keywords: '#bb9af7',
    strings: '#9ece6a',
    functions: '#7aa2f7',
    numbers: '#ff9e64',
    stringEscape: '#89ddff',
    regexp: '#b4f9f8',
    constants: '#ff9e64',
    storage: '#bb9af7',
    punctuation: '#89ddff',
    functionsBuiltin: '#0db9d7',
    types: '#0db9d7',
    typesBuiltin: '#0db9d7',
    variables: '#c0caf5',
    variablesProperty: '#7dcfff',
    tags: '#f7768e',
    tagsAttribute: '#bb9af7',
    markup: '#bb9af7',
    diffInserted: '#9ece6a',
    diffDeleted: '#f7768e',
    diffChanged: '#ff9e64',
    invalid: '#ff5370',
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    author: 'rose-pine',
    category: 'Best-looking',
    mode: 'light',
    background: '#faf4ed',
    text: '#575279',
    comments: '#9893a5',
    keywords: '#286983',
    strings: '#ea9d34',
    functions: '#d7827e',
    numbers: '#d7827e',
    stringEscape: '#286983',
    regexp: '#ea9d34',
    constants: '#d7827e',
    storage: '#286983',
    punctuation: '#797593',
    functionsBuiltin: '#b4637a',
    types: '#56949f',
    typesBuiltin: '#56949f',
    variables: '#575279',
    variablesProperty: '#575279',
    tags: '#56949f',
    tagsAttribute: '#907aa9',
    markup: '#286983',
    diffInserted: '#56949f',
    diffDeleted: '#b4637a',
    diffChanged: '#907aa9',
    invalid: '#b4637a',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    author: 'Sarah Drasner',
    category: 'Readability',
    mode: 'dark',
    background: '#011627',
    text: '#d6deeb',
    comments: '#637777',
    keywords: '#c792ea',
    strings: '#ecc48d',
    functions: '#82aaff',
    numbers: '#f78c6c',
    stringEscape: '#f78c6c',
    regexp: '#5ca7e4',
    constants: '#82aaff',
    storage: '#c792ea',
    punctuation: '#d6deeb',
    functionsBuiltin: '#c5e478',
    types: '#ffcb8b',
    typesBuiltin: '#c5e478',
    variables: '#c5e478',
    variablesProperty: '#baebe2',
    tags: '#caece6',
    tagsAttribute: '#c5e478',
    markup: '#c792ea',
    diffInserted: '#c5e478',
    diffDeleted: '#ef5350',
    diffChanged: '#a2bffc',
    invalid: '#ffffff',
  },
  {
    id: 'github-dark-dimmed',
    name: 'GitHub Dark Dimmed',
    author: 'GitHub',
    category: 'Readability',
    mode: 'dark',
    background: '#22272e',
    text: '#adbac7',
    comments: '#768390',
    keywords: '#f47067',
    strings: '#96d0ff',
    functions: '#dcbdfb',
    numbers: '#6cb6ff',
    stringEscape: '#f47067',
    regexp: '#96d0ff',
    constants: '#6cb6ff',
    storage: '#f47067',
    punctuation: '#adbac7',
    functionsBuiltin: '#6cb6ff',
    types: '#f69d50',
    typesBuiltin: '#6cb6ff',
    variables: '#adbac7',
    variablesProperty: '#adbac7',
    tags: '#8ddb8c',
    tagsAttribute: '#6cb6ff',
    markup: '#adbac7',
    diffInserted: '#8ddb8c',
    diffDeleted: '#ff938a',
    diffChanged: '#f69d50',
    invalid: '#ff938a',
  },
  {
    id: 'github-light-default',
    name: 'GitHub Light Default',
    author: 'GitHub',
    category: 'Readability',
    mode: 'light',
    background: '#ffffff',
    text: '#1f2328',
    comments: '#6e7781',
    keywords: '#cf222e',
    strings: '#0a3069',
    functions: '#8250df',
    numbers: '#0550ae',
    stringEscape: '#cf222e',
    regexp: '#0a3069',
    constants: '#0550ae',
    storage: '#cf222e',
    punctuation: '#1f2328',
    functionsBuiltin: '#0550ae',
    types: '#953800',
    typesBuiltin: '#0550ae',
    variables: '#1f2328',
    variablesProperty: '#1f2328',
    tags: '#116329',
    tagsAttribute: '#0550ae',
    markup: '#1f2328',
    diffInserted: '#116329',
    diffDeleted: '#82071e',
    diffChanged: '#953800',
    invalid: '#82071e',
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    author: 'Ethan Schoonover',
    category: 'Readability',
    mode: 'light',
    background: '#fdf6e3',
    text: '#657b83',
    comments: '#93a1a1',
    keywords: '#859900',
    strings: '#2aa198',
    functions: '#268bd2',
    numbers: '#d33682',
    stringEscape: '#cb4b16',
    regexp: '#dc322f',
    constants: '#b58900',
    storage: '#586e75',
    punctuation: '#657b83',
    functionsBuiltin: '#268bd2',
    types: '#cb4b16',
    typesBuiltin: '#859900',
    variables: '#268bd2',
    variablesProperty: '#268bd2',
    tags: '#268bd2',
    tagsAttribute: '#93a1a1',
    markup: '#d33682',
    diffInserted: '#859900',
    diffDeleted: '#dc322f',
    diffChanged: '#cb4b16',
    invalid: '#dc322f',
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
