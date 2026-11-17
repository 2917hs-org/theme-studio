import type { BaseRoles } from './baseRoles';
import type { AnsiPalette } from './ansiPalette';

// Windows Terminal's color-scheme object — https://learn.microsoft.com/en-us/windows/terminal/customize-settings/color-schemes.
// Note the magenta slot is genuinely named "purple"/"brightPurple" in this
// schema, not "magenta" — that's Windows Terminal's own naming, not a typo.
export interface WindowsTerminalScheme {
  name: string;
  background: string;
  foreground: string;
  cursorColor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightPurple: string;
  brightCyan: string;
  brightWhite: string;
}

/** Builds a single Windows Terminal color-scheme object — paste it into the `"schemes"` array of Windows Terminal's `settings.json`. */
export function buildWindowsTerminalScheme(name: string, base: BaseRoles, ansi: AnsiPalette): WindowsTerminalScheme {
  return {
    name,
    background: base.background,
    foreground: base.foreground,
    cursorColor: base.foreground,
    selectionBackground: ansi.brightBlack,
    black: ansi.black,
    red: ansi.red,
    green: ansi.green,
    yellow: ansi.yellow,
    blue: ansi.blue,
    purple: ansi.magenta,
    cyan: ansi.cyan,
    white: ansi.white,
    brightBlack: ansi.brightBlack,
    brightRed: ansi.brightRed,
    brightGreen: ansi.brightGreen,
    brightYellow: ansi.brightYellow,
    brightBlue: ansi.brightBlue,
    brightPurple: ansi.brightMagenta,
    brightCyan: ansi.brightCyan,
    brightWhite: ansi.brightWhite,
  };
}

export function windowsTerminalJson(name: string, base: BaseRoles, ansi: AnsiPalette): string {
  return JSON.stringify(buildWindowsTerminalScheme(name, base, ansi), null, 2);
}
