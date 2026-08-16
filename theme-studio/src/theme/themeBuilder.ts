import type * as monaco from 'monaco-editor';
import { baselineColorsFor, defaultForegroundFor, isolatedForegroundFor } from './baseline';
import type { ChromeOverride } from './chrome';
import type { ThemeMode } from './mode';

export interface VSCodeTheme {
  name: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
  tokenColors: Array<{
    name?: string;
    scope: string | string[];
    settings: { foreground?: string; fontStyle?: string };
  }>;
}

export function buildVSCodeTheme(
  name: string,
  mode: ThemeMode,
  assignments: Map<string, string>,
  chrome?: ChromeOverride,
): VSCodeTheme {
  return {
    name,
    type: mode,
    colors: { ...baselineColorsFor(mode, chrome) },
    tokenColors: [
      { name: 'Default', scope: ['source'], settings: { foreground: defaultForegroundFor(mode, chrome) } },
      ...[...assignments.entries()].map(([scope, color]) => ({
        name: scope,
        scope,
        settings: { foreground: color },
      })),
    ],
  };
}

/**
 * `isolate: true` drops Monaco's own built-in syntax colors entirely
 * (`inherit: false`) and flattens every un-assigned token to one neutral
 * gray, so only scopes you've actually colored stand out — a way to answer
 * "is this really mine, or just a default that happens to look similar?"
 * without guessing from hue alone. The exported VSIX theme never uses this;
 * it's a live-preview-only view.
 */
export function buildMonacoTheme(
  mode: ThemeMode,
  assignments: Map<string, string>,
  options?: { isolate?: boolean; chrome?: ChromeOverride },
): monaco.editor.IStandaloneThemeData {
  const isolate = options?.isolate ?? false;
  const chrome = options?.chrome;
  return {
    base: mode === 'dark' ? 'vs-dark' : 'vs',
    inherit: !isolate,
    rules: [
      ...(isolate ? [{ token: '', foreground: isolatedForegroundFor(mode).replace('#', '') }] : []),
      ...[...assignments.entries()].map(([scope, color]) => ({
        token: scope,
        foreground: color.replace('#', ''),
      })),
    ],
    colors: { ...baselineColorsFor(mode, chrome) },
  };
}
