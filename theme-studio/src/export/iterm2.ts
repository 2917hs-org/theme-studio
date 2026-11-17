import { hexToRgb } from '../theme/colorParse';
import type { BaseRoles } from './baseRoles';
import type { AnsiPalette } from './ansiPalette';

// iTerm2's .itermcolors format is a plain Apple property list: a flat dict
// of named color entries, each itself a dict of 0–1 float RGB components.
// There's deliberately no "name" field in the file at all — iTerm2 names an
// imported profile after the file's own basename, so the theme name here
// only ever affects the *filename*, never anything inside this XML.
//
// Ansi 0–7 are the normal 8 colors (black, red, green, yellow, blue,
// magenta, cyan, white, in that fixed order); Ansi 8–15 are their bright
// counterparts in the same order — this is iTerm2's own convention, not
// something this app invented.

function component(n: number): string {
  return String(n / 255);
}

function colorDict(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `\t<dict>
\t\t<key>Color Space</key>
\t\t<string>sRGB</string>
\t\t<key>Red Component</key>
\t\t<real>${component(r)}</real>
\t\t<key>Green Component</key>
\t\t<real>${component(g)}</real>
\t\t<key>Blue Component</key>
\t\t<real>${component(b)}</real>
\t\t<key>Alpha Component</key>
\t\t<real>1</real>
\t</dict>`;
}

function entry(key: string, hex: string): string {
  return `\t<key>${key}</key>\n${colorDict(hex)}`;
}

const ANSI_ORDER: Array<keyof AnsiPalette> = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
];

/** Builds a complete, real `.itermcolors` plist — double-clickable in iTerm2 (Preferences → Profiles → Colors → Color Presets → Import). */
export function buildItermColorsPlist(base: BaseRoles, ansi: AnsiPalette): string {
  const entries = [
    ...ANSI_ORDER.map((key, i) => entry(`Ansi ${i} Color`, ansi[key])),
    entry('Background Color', base.background),
    entry('Foreground Color', base.foreground),
    entry('Cursor Color', base.foreground),
    entry('Cursor Text Color', base.background),
    entry('Selection Color', ansi.brightBlack),
    entry('Selected Text Color', base.foreground),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${entries.join('\n')}
</dict>
</plist>
`;
}
