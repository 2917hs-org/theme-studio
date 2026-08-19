import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { ImportedTheme } from '../theme/importTheme';
import { clearPersistedTheme, hasMeaningfulContent, loadPersistedTheme, savePersistedTheme } from './persistedTheme';

export type { ChromeOverride };

export const DEFAULT_THEME_NAME = 'My Theme';
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
  /** Defaults to the active mode; pass a mode explicitly to target the other one directly. */
  setColor: (scope: string, color: string, mode?: ThemeMode) => void;
  clearColor: (scope: string, mode?: ThemeMode) => void;
  /** Clears every color assignment in both modes, but leaves the theme name alone. */
  clearAllColors: () => void;
  /** Replaces the entire theme-in-progress with `theme` — name, and assignments/chrome for BOTH modes, not just whichever ones the import defines (a mode the import doesn't touch is cleared, not left with whatever was there before). Also switches the active mode to the first imported variant. */
  importTheme: (theme: ImportedTheme) => void;
  /** Most-recently-used colors across both modes, newest first — a personal palette shortcut. */
  recentColors: string[];
  /** Everything this context owns, back to first-load defaults: mode, assignments, chrome overrides, theme name, recent colors. Also clears the autosaved session. */
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
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [chromeByMode, setChromeByMode] = useState<Record<ThemeMode, ChromeOverride>>(() =>
    restored ? { dark: restored.chrome.dark ?? {}, light: restored.chrome.light ?? {} } : emptyChromeByMode(),
  );

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

  const assignmentsFor = useCallback((m: ThemeMode) => assignmentsByMode[m], [assignmentsByMode]);

  const setChrome = useCallback((targetMode: ThemeMode, chrome: ChromeOverride) => {
    setChromeByMode((prev) => ({ ...prev, [targetMode]: { ...prev[targetMode], ...chrome } }));
  }, []);

  const chromeFor = useCallback((m: ThemeMode) => chromeByMode[m], [chromeByMode]);

  const importTheme = useCallback((theme: ImportedTheme) => {
    setThemeName(theme.name);
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
    setRecentColors([]);
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
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [mode, themeName, assignmentsByMode, chromeByMode]);

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
      setColor,
      clearColor,
      clearAllColors,
      importTheme,
      recentColors,
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
      setColor,
      clearColor,
      clearAllColors,
      importTheme,
      recentColors,
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
