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

// Color values below are drawn from each theme's own published source
// (its VS Code extension's theme JSON, or — for Catppuccin — its official
// palette/style-guide docs), not guessed: an homage built from the same
// real colors, not a redistribution of the extension itself. See `author`
// on each entry for who actually designed it.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    author: 'enkia',
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
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    author: 'binaryify',
    mode: 'dark',
    background: '#282c34',
    text: '#abb2bf',
    comments: '#7f848e',
    keywords: '#c678dd',
    strings: '#98c379',
    functions: '#61afef',
    numbers: '#d19a66',
    stringEscape: '#56b6c2',
    regexp: '#56b6c2',
    constants: '#d19a66',
    storage: '#c678dd',
    punctuation: '#abb2bf',
    functionsBuiltin: '#61afef',
    types: '#e5c07b',
    typesBuiltin: '#e5c07b',
    variables: '#e06c75',
    variablesProperty: '#abb2bf',
    tags: '#e06c75',
    tagsAttribute: '#d19a66',
    markup: '#c678dd',
    diffInserted: '#98c379',
    diffDeleted: '#e06c75',
    diffChanged: '#e5c07b',
    invalid: '#e06c75',
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    author: 'GitHub',
    mode: 'light',
    background: '#ffffff',
    text: '#1f2328',
    comments: '#57606a',
    keywords: '#cf222e',
    strings: '#0a3069',
    functions: '#8250df',
    numbers: '#0550ae',
    stringEscape: '#0a3069',
    regexp: '#cf222e',
    constants: '#0550ae',
    storage: '#cf222e',
    punctuation: '#57606a',
    functionsBuiltin: '#8250df',
    types: '#0550ae',
    typesBuiltin: '#0550ae',
    variables: '#953800',
    variablesProperty: '#0550ae',
    tags: '#116329',
    tagsAttribute: '#953800',
    markup: '#cf222e',
    diffInserted: '#1a7f37',
    diffDeleted: '#cf222e',
    diffChanged: '#953800',
    invalid: '#cf222e',
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    author: 'Catppuccin',
    mode: 'light',
    background: '#eff1f5',
    text: '#4c4f69',
    comments: '#7c7f93',
    keywords: '#8839ef',
    strings: '#40a02b',
    functions: '#1e66f5',
    numbers: '#fe640b',
    stringEscape: '#ea76cb',
    regexp: '#ea76cb',
    constants: '#fe640b',
    storage: '#8839ef',
    punctuation: '#6c6f85',
    functionsBuiltin: '#1e66f5',
    types: '#df8e1d',
    typesBuiltin: '#df8e1d',
    variables: '#e64553',
    variablesProperty: '#4c4f69',
    tags: '#d20f39',
    tagsAttribute: '#df8e1d',
    markup: '#8839ef',
    diffInserted: '#40a02b',
    diffDeleted: '#d20f39',
    diffChanged: '#1e66f5',
    invalid: '#d20f39',
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
