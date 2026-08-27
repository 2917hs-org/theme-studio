import type { PresetField } from '../theme/presetPalette';
import type { ThemeMode } from '../theme/mode';
import type { BaseRoles } from './baseRoles';
import type { AnsiPalette } from './ansiPalette';

// Verified against Zed's actual schema (https://zed.dev/schema/themes/v0.2.0.json)
// and a real shipped theme (zed-industries/zed's assets/themes/one/one.json)
// rather than assumed — see the roadmap doc's own warning that Zed's format
// shouldn't be hard-coded from memory. Two details that aren't obvious from
// the schema alone: colors carry a trailing alpha byte ("#rrggbbaa", always
// "ff" here), and `syntax` keys are tree-sitter highlight-capture names
// (`comment`, `string.escape`, `punctuation.bracket`, ...), not free-form —
// the schema itself allows any string key, but only names Zed's own
// highlighter actually looks for will render.

interface HighlightStyle {
  color: string;
  font_style: 'italic' | null;
  font_weight: null;
}

interface ZedThemeStyle {
  background: string;
  foreground: string;
  'editor.background': string;
  'editor.foreground': string;
  'terminal.background': string;
  'terminal.foreground': string;
  'terminal.ansi.background': string;
  'terminal.ansi.black': string;
  'terminal.ansi.red': string;
  'terminal.ansi.green': string;
  'terminal.ansi.yellow': string;
  'terminal.ansi.blue': string;
  'terminal.ansi.magenta': string;
  'terminal.ansi.cyan': string;
  'terminal.ansi.white': string;
  'terminal.ansi.bright_black': string;
  'terminal.ansi.bright_red': string;
  'terminal.ansi.bright_green': string;
  'terminal.ansi.bright_yellow': string;
  'terminal.ansi.bright_blue': string;
  'terminal.ansi.bright_magenta': string;
  'terminal.ansi.bright_cyan': string;
  'terminal.ansi.bright_white': string;
  syntax: Record<string, HighlightStyle>;
}

export interface ZedThemeFile {
  $schema: string;
  name: string;
  author: string;
  themes: Array<{
    name: string;
    appearance: 'dark' | 'light';
    style: ZedThemeStyle;
  }>;
}

function withAlpha(hex: string): string {
  return `${hex}ff`;
}

function style(color: string, italic = false): HighlightStyle {
  return { color: withAlpha(color), font_style: italic ? 'italic' : null, font_weight: null };
}

// Each Zed syntax key's candidate fields, most-specific first — the first
// field that's actually been colored wins. Limited to keys this app can map
// with real confidence; Zed has plenty more (its schema allows arbitrary
// keys) but a wrong-looking guess is worse than simply leaving one unset —
// unset keys just fall back to Zed's own theme defaults instead of exporting
// a truly broken color.
const SYNTAX_FIELD_CANDIDATES: Record<string, PresetField[]> = {
  comment: ['comments'],
  'comment.doc': ['comments'],
  string: ['strings'],
  'string.escape': ['stringEscape', 'strings'],
  'string.regex': ['regexp', 'strings'],
  keyword: ['keywords'],
  function: ['functions', 'functionsBuiltin'],
  constant: ['constants'],
  boolean: ['constants'],
  number: ['numbers'],
  type: ['types', 'typesBuiltin'],
  enum: ['types'],
  variable: ['variables'],
  'variable.parameter': ['variables'],
  property: ['variablesProperty', 'variables'],
  tag: ['tags'],
  attribute: ['tagsAttribute', 'tags'],
  punctuation: ['punctuation'],
  'punctuation.bracket': ['punctuation'],
  'punctuation.delimiter': ['punctuation'],
  operator: ['punctuation'],
  title: ['markup'],
  emphasis: ['markup'],
  'emphasis.strong': ['markup'],
  'diff.plus': ['diffInserted'],
  'diff.minus': ['diffDeleted'],
};

function buildSyntax(accentsByField: Partial<Record<PresetField, string>>): Record<string, HighlightStyle> {
  const syntax: Record<string, HighlightStyle> = {};
  for (const [zedKey, candidates] of Object.entries(SYNTAX_FIELD_CANDIDATES)) {
    const field = candidates.find((f) => accentsByField[f]);
    if (field) syntax[zedKey] = style(accentsByField[field]!, zedKey === 'comment' || zedKey === 'comment.doc');
  }
  return syntax;
}

export function buildZedTheme(
  name: string,
  mode: ThemeMode,
  base: BaseRoles,
  ansi: AnsiPalette,
  accentsByField: Partial<Record<PresetField, string>>,
): ZedThemeFile {
  return {
    $schema: 'https://zed.dev/schema/themes/v0.2.0.json',
    name,
    author: 'VS Code Theme Studio',
    themes: [
      {
        name,
        appearance: mode,
        style: {
          background: withAlpha(base.background),
          foreground: withAlpha(base.foreground),
          'editor.background': withAlpha(base.background),
          'editor.foreground': withAlpha(base.foreground),
          'terminal.background': withAlpha(base.background),
          'terminal.foreground': withAlpha(base.foreground),
          'terminal.ansi.background': withAlpha(base.background),
          'terminal.ansi.black': withAlpha(ansi.black),
          'terminal.ansi.red': withAlpha(ansi.red),
          'terminal.ansi.green': withAlpha(ansi.green),
          'terminal.ansi.yellow': withAlpha(ansi.yellow),
          'terminal.ansi.blue': withAlpha(ansi.blue),
          'terminal.ansi.magenta': withAlpha(ansi.magenta),
          'terminal.ansi.cyan': withAlpha(ansi.cyan),
          'terminal.ansi.white': withAlpha(ansi.white),
          'terminal.ansi.bright_black': withAlpha(ansi.brightBlack),
          'terminal.ansi.bright_red': withAlpha(ansi.brightRed),
          'terminal.ansi.bright_green': withAlpha(ansi.brightGreen),
          'terminal.ansi.bright_yellow': withAlpha(ansi.brightYellow),
          'terminal.ansi.bright_blue': withAlpha(ansi.brightBlue),
          'terminal.ansi.bright_magenta': withAlpha(ansi.brightMagenta),
          'terminal.ansi.bright_cyan': withAlpha(ansi.brightCyan),
          'terminal.ansi.bright_white': withAlpha(ansi.brightWhite),
          syntax: buildSyntax(accentsByField),
        },
      },
    ],
  };
}

export function zedThemeJson(
  name: string,
  mode: ThemeMode,
  base: BaseRoles,
  ansi: AnsiPalette,
  accentsByField: Partial<Record<PresetField, string>>,
): string {
  return JSON.stringify(buildZedTheme(name, mode, base, ansi, accentsByField), null, 2);
}
