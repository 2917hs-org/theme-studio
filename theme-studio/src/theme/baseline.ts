import type { ThemeMode } from './mode';
import type { ChromeOverride } from './chrome';

// Sane baseline editor-chrome colors, VS Code Dark+/Light+ derived — the
// starting point every mode has before a preset or manual override touches
// `editor.background` / `editor.foreground`.
const DARK_BASELINE_COLORS: Record<string, string> = {
  'editor.background': '#1e1e1e',
  'editor.foreground': '#d4d4d4',
  'editorLineNumber.foreground': '#858585',
  'editorLineNumber.activeForeground': '#c6c6c6',
  'editor.selectionBackground': '#264f78',
  'editor.lineHighlightBackground': '#2a2a2a',
  'editorCursor.foreground': '#aeafad',
  'editorWhitespace.foreground': '#3b3b3b',
  'editorIndentGuide.background1': '#404040',
};

const LIGHT_BASELINE_COLORS: Record<string, string> = {
  'editor.background': '#ffffff',
  'editor.foreground': '#000000',
  'editorLineNumber.foreground': '#237893',
  'editorLineNumber.activeForeground': '#0b216f',
  'editor.selectionBackground': '#add6ff',
  'editor.lineHighlightBackground': '#f3f3f3',
  'editorCursor.foreground': '#000000',
  'editorWhitespace.foreground': '#d3d3d3',
  'editorIndentGuide.background1': '#d3d3d3',
};

export function baselineColorsFor(mode: ThemeMode, override?: ChromeOverride): Record<string, string> {
  const base = mode === 'dark' ? DARK_BASELINE_COLORS : LIGHT_BASELINE_COLORS;
  if (!override?.background && !override?.foreground) return base;
  return {
    ...base,
    ...(override.background ? { 'editor.background': override.background } : {}),
    ...(override.foreground ? { 'editor.foreground': override.foreground } : {}),
  };
}

export function defaultForegroundFor(mode: ThemeMode, override?: ChromeOverride): string {
  if (override?.foreground) return override.foreground;
  return mode === 'dark' ? '#d4d4d4' : '#000000';
}

// Flat, deliberately muted stand-in for "everything you haven't colored
// yet" — used by the editor's isolate mode so assigned scopes visibly pop
// against a neutral background instead of blending into Monaco's own rich
// (and sometimes coincidentally similar-looking) default syntax colors.
export function isolatedForegroundFor(mode: ThemeMode): string {
  return mode === 'dark' ? '#6a6a6a' : '#9a9a9a';
}
