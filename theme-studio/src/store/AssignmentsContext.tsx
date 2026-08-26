import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { ImportedTheme } from '../theme/importTheme';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';
import { clearPersistedTheme, hasMeaningfulContent, loadPersistedTheme, savePersistedTheme } from './persistedTheme';
import { DEFAULT_THEME_NAME } from './defaultThemeName';
import { AssignmentsContext } from './assignmentsContextCore';

export type { ChromeOverride };

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
  // A restored session's saved `themeName` is treated as already-customized
  // text, never auto-fill fodder — only a genuinely empty restore (or no
  // restore at all) starts out auto-tracking.
  const [themeNameAutoTracked, setThemeNameAutoTracked] = useState(() => !restored?.themeName);
  // Never persisted — see ExportPanel.tsx's auto-fill effect for how this
  // pairs with `themeNameAutoTracked` above.
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
    setThemeNameAutoTracked(true);
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
      themeNameAutoTracked,
      setThemeNameAutoTracked,
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
      themeNameAutoTracked,
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
