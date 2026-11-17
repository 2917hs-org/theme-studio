import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import { slugify } from '../vsix/buildVsix';
import { accentColorsByField, extractBaseRoles, MIN_POPULATED_ACCENTS_FOR_EXTERNAL_EXPORT } from './baseRoles';
import { deriveAnsiPalette } from './ansiPalette';
import { windowsTerminalJson } from './windowsTerminal';
import { buildItermColorsPlist } from './iterm2';
import { zedThemeJson } from './zed';

export type ExportFormatId = 'vscode' | 'windows-terminal' | 'iterm2' | 'zed';

export interface ExportFormatMeta {
  id: ExportFormatId;
  label: string;
}

// VS Code stays first/default — every other target is new surface area for
// the same underlying colors, not a replacement for the app's original
// purpose.
export const EXPORT_FORMATS: ExportFormatMeta[] = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'windows-terminal', label: 'Windows Terminal' },
  { id: 'iterm2', label: 'iTerm2' },
  { id: 'zed', label: 'Zed' },
];

export type SingleFileFormatId = Exclude<ExportFormatId, 'vscode'>;

export function isSingleFileFormat(id: ExportFormatId): id is SingleFileFormatId {
  return id !== 'vscode';
}

/**
 * Whether the current mode has enough of a real color identity — not just a
 * couple of arbitrary scopes — for a terminal/editor export to look like a
 * coherent palette rather than mostly synthesized fallback colors. Checked
 * against the *current* mode's assignments, since these single-file formats
 * (unlike the dual-mode VSIX) only ever export one mode at a time.
 */
export function hasEnoughForSingleFileExport(mode: ThemeMode, assignments: Map<string, string>, chrome: ChromeOverride): boolean {
  return extractBaseRoles(mode, assignments, chrome).populatedAccentCount >= MIN_POPULATED_ACCENTS_FOR_EXTERNAL_EXPORT;
}

export interface SingleFileExport {
  content: string;
  filename: string;
}

/** Builds the downloadable file for one of the non-VS Code targets, from whatever the current mode has actually colored. */
export function buildSingleFileExport(
  format: SingleFileFormatId,
  themeName: string,
  mode: ThemeMode,
  assignments: Map<string, string>,
  chrome: ChromeOverride,
): SingleFileExport {
  const base = extractBaseRoles(mode, assignments, chrome);
  const ansi = deriveAnsiPalette(base.background, base.foreground, base.accents);
  const slug = slugify(themeName);

  switch (format) {
    case 'windows-terminal':
      return { content: windowsTerminalJson(themeName, base, ansi), filename: `${slug}.windowsterminal.json` };
    case 'iterm2':
      return { content: buildItermColorsPlist(base, ansi), filename: `${slug}.itermcolors` };
    case 'zed':
      return {
        content: zedThemeJson(themeName, mode, base, ansi, accentColorsByField(assignments)),
        filename: `${slug}-zed-theme.json`,
      };
  }
}
