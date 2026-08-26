import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { ImportedTheme } from '../theme/importTheme';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';
import { clearPersistedTheme, hasMeaningfulContent, loadPersistedTheme, savePersistedTheme } from './persistedTheme';

export type { ChromeOverride };

// Empty by default — the Theme name field now auto-fills a "vsts-..."
// pattern from whatever's actually selected (see ExportPanel.tsx), rather
// than starting pre-filled with a placeholder-looking name.
export const DEFAULT_THEME_NAME = '';
const MAX_RECENT_COLORS = 12;
// Debounced so dragging a color picker (which fires setColor continuously)
// doesn't write to localStorage on every frame.
const PERSIST_DEBOUNCE_MS = 500;

function emptyAssignmentsByMode(): Record<ThemeMode, Map<string, string>> {
  return { dark: new Map(), light: new Map() };
}

function emptyChromeByMode(): Record<ThemeMode, ChromeOverride> {
  return { dark: {}, light: {} };
}

interface AssignmentsContextValue {
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

const AssignmentsContext = createContext<AssignmentsContextValue | null>(null);

export function AssignmentsProvider({ children }: { children: ReactNode }) {
  // Read once, synchronously, before any state initializes — every useState
  // below that seeds from `restored` runs in the same render pass, so this
  // being set first is what makes that safe.
  const [restored] = useState(() => loadPersistedTheme());
  const [wasRestored] = useState(() => Boolean(restored && hasMeaningfulContent(restored)));

  const [mode, setMode] = useState<ThemeMode>(restored?.mode ?? 'light');
  const [assignmentsByMode, setAssignmentsByMode] = useState<Record<ThemeMode, Map<string, string>>>(() =>
    restored
      ? { dark: new Map(restored.assignments.dark ?? []), light: new Map(restored.assignments.light ?? []) }
      : emptyAssignmentsByMode(),
  );
  const [themeName, setThemeName] = useState(restored?.themeName ?? DEFAULT_THEME_NAME);
  // Never persisted — a restored session's saved `themeName` is treated as
  // already-customized text (see ExportPanel.tsx's divergence check), so
  // there's no reliable "was this still auto-tracking" fact to restore here.
  const [productThemeName, setProductThemeName] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [chromeByMode, setChromeByMode] = useState<Record<ThemeMode, ChromeOverride>>(() =>
    restored ? { dark: restored.chrome.dark ?? {}, light: restored.chrome.light ?? {} } : emptyChromeByMode(),
  );
  const [pairedIconTheme, setPairedIconTheme] = useState<PairedIconTheme | null>(restored?.pairedIconTheme ?? null);

  const setColor = useCallback(
    (scope: string, color: string, targetMode?: ThemeMode) => {
      const m = targetMode ?? mode;
      setAssignmentsByMode((prev) => {
        const next = { ...prev, [m]: new Map(prev[m]) };
        next[m].set(scope, color);
        return next;
      });
      setRecentColors((prev) => {
        const withoutDupe = prev.filter((c) => c.toLowerCase() !== color.toLowerCase());
        return [color, ...withoutDupe].slice(0, MAX_RECENT_COLORS);
      });
    },
    [mode],
  );

  const clearColor = useCallback(
    (scope: string, targetMode?: ThemeMode) => {
      const m = targetMode ?? mode;
      setAssignmentsByMode((prev) => {
        const next = { ...prev, [m]: new Map(prev[m]) };
        next[m].delete(scope);
        return next;
      });
    },
    [mode],
  );

  const clearAllColors = useCallback(() => {
    setAssignmentsByMode(emptyAssignmentsByMode());
  }, []);

  const replaceAssignments = useCallback((targetMode: ThemeMode, assignments: Map<string, string>) => {
    setAssignmentsByMode((prev) => ({ ...prev, [targetMode]: new Map(assignments) }));
  }, []);

  const assignmentsFor = useCallback((m: ThemeMode) => assignmentsByMode[m], [assignmentsByMode]);

  const setChrome = useCallback((targetMode: ThemeMode, chrome: ChromeOverride) => {
    setChromeByMode((prev) => ({ ...prev, [targetMode]: { ...prev[targetMode], ...chrome } }));
  }, []);

  const chromeFor = useCallback((m: ThemeMode) => chromeByMode[m], [chromeByMode]);

  const importTheme = useCallback((theme: ImportedTheme) => {
    setProductThemeName(theme.name);
    // Start from empty, not from the previous state — a theme with only a
    // dark variant (most Marketplace themes) must still clear light, not
    // leave whatever was there from a theme imported earlier.
    setAssignmentsByMode(() => {
      const next = emptyAssignmentsByMode();
      for (const variant of theme.variants) next[variant.mode] = variant.assignments;
      return next;
    });
    setChromeByMode(() => {
      const next = emptyChromeByMode();
      for (const variant of theme.variants) next[variant.mode] = variant.chrome;
      return next;
    });
    setMode(theme.variants[0].mode);
    // The picker's "Recently used" swatches are scoped to the theme you're
    // building — carrying them over here would show colors from whatever
    // was just wiped out, unrelated to the theme just imported.
    setRecentColors([]);
  }, []);

  const resetAll = useCallback(() => {
    setMode('light');
    setAssignmentsByMode(emptyAssignmentsByMode());
    setChromeByMode(emptyChromeByMode());
    setThemeName(DEFAULT_THEME_NAME);
    setProductThemeName(null);
    setRecentColors([]);
    setPairedIconTheme(null);
    clearPersistedTheme();
  }, []);

  // Autosave — debounced, and skipped on the very first render so restoring
  // from storage doesn't immediately turn around and rewrite it.
  const isFirstPersistRef = useRef(true);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isFirstPersistRef.current) {
      isFirstPersistRef.current = false;
      return;
    }
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      savePersistedTheme({
        version: 1,
        mode,
        themeName,
        assignments: {
          dark: [...assignmentsByMode.dark.entries()],
          light: [...assignmentsByMode.light.entries()],
        },
        chrome: chromeByMode,
        pairedIconTheme,
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [mode, themeName, assignmentsByMode, chromeByMode, pairedIconTheme]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      assignments: assignmentsByMode[mode],
      assignmentsFor,
      chrome: chromeByMode[mode],
      chromeFor,
      setChrome,
      themeName,
      setThemeName,
      productThemeName,
      setProductThemeName,
      setColor,
      clearColor,
      clearAllColors,
      replaceAssignments,
      importTheme,
      recentColors,
      pairedIconTheme,
      setPairedIconTheme,
      resetAll,
      wasRestored,
    }),
    [
      mode,
      assignmentsByMode,
      assignmentsFor,
      chromeByMode,
      chromeFor,
      setChrome,
      themeName,
      productThemeName,
      setColor,
      clearColor,
      clearAllColors,
      replaceAssignments,
      importTheme,
      recentColors,
      pairedIconTheme,
      resetAll,
      wasRestored,
    ],
  );

  return <AssignmentsContext.Provider value={value}>{children}</AssignmentsContext.Provider>;
}

export function useAssignments(): AssignmentsContextValue {
  const ctx = useContext(AssignmentsContext);
  if (!ctx) throw new Error('useAssignments must be used within AssignmentsProvider');
  return ctx;
}
