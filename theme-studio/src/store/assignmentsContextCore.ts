import { createContext } from 'react';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { ImportedTheme } from '../theme/importTheme';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';

// The context object and its value type, split out from AssignmentsContext.tsx
// so that file exports only the AssignmentsProvider component — a file
// exporting a React context (even alongside a component) breaks Fast Refresh
// for the component (react/only-export-components: "Move your React
// context(s) to a separate file").
export interface AssignmentsContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** The active mode's assignments — what the editor/inspector should use. */
  assignments: Map<string, string>;
  /** Read either mode's assignments regardless of which is active (for export). */
  assignmentsFor: (mode: ThemeMode) => Map<string, string>;
  /** The active mode's background/text override, if any. */
  chrome: ChromeOverride;
  /** Read either mode's chrome override regardless of which is active (for export). */
  chromeFor: (mode: ThemeMode) => ChromeOverride;
  /** Merges into the existing override for that mode — omit a field to leave it as-is. */
  setChrome: (mode: ThemeMode, chrome: ChromeOverride) => void;
  themeName: string;
  setThemeName: (name: string) => void;
  /** Whether the Theme name field should keep following the "vsts-[product]-[icon]" auto-fill as presets/icon pairings change — true until the user directly edits the field, and re-armed by resetAll(). Lives here (not as component-local state in ExportPanel) so resetAll can actually clear it; see ExportPanel.tsx's auto-fill effect for how it's used. */
  themeNameAutoTracked: boolean;
  setThemeNameAutoTracked: (tracked: boolean) => void;
  /** The name of whichever product/color theme is currently selected — a preset, or an uploaded/Marketplace theme's own name. Null until one is actually picked (hand-coloring from scratch doesn't set this). Feeds the "vsts-[product-theme]-[icon-theme]" auto-fill in ExportPanel.tsx; distinct from `themeName` so a later selection can still update the auto-fill even after the user has typed a custom name that no longer matches it verbatim. */
  productThemeName: string | null;
  setProductThemeName: (name: string | null) => void;
  /** Defaults to the active mode; pass a mode explicitly to target the other one directly. */
  setColor: (scope: string, color: string, mode?: ThemeMode) => void;
  clearColor: (scope: string, mode?: ThemeMode) => void;
  /** Clears every color assignment in both modes, but leaves the theme name alone. */
  clearAllColors: () => void;
  /** Replaces that mode's entire assignment map with `assignments` — unlike setColor/clearColor (which touch one scope), any existing scope not present in the new map is dropped, not left over. Use this for "apply a whole theme to this mode" (presets, imports), never for a single color edit. */
  replaceAssignments: (mode: ThemeMode, assignments: Map<string, string>) => void;
  /** Replaces the entire theme-in-progress with `theme` — assignments/chrome for BOTH modes, not just whichever ones the import defines (a mode the import doesn't touch is cleared, not left with whatever was there before), and switches the active mode to the first imported variant. Sets `productThemeName` to the imported theme's own name; deliberately does not touch `themeName` directly — that's ExportPanel's auto-fill's job, so a custom name the user already typed isn't silently overwritten by an import. */
  importTheme: (theme: ImportedTheme) => void;
  /** Most-recently-used colors across both modes, newest first — a personal palette shortcut. */
  recentColors: string[];
  /** The Marketplace icon theme paired with this color theme, if any — a reference only (publisher + extension id), never downloaded. Independent of color assignments: importing or clearing colors doesn't touch it. */
  pairedIconTheme: PairedIconTheme | null;
  setPairedIconTheme: (theme: PairedIconTheme | null) => void;
  /** Everything this context owns, back to first-load defaults: mode, assignments, chrome overrides, theme name, recent colors, paired icon theme. Also clears the autosaved session. */
  resetAll: () => void;
  /** True for exactly one mount — whether this session's initial state came from a non-empty autosaved session, so the UI can mention it once (e.g. a toast). */
  wasRestored: boolean;
}

export const AssignmentsContext = createContext<AssignmentsContextValue | null>(null);
