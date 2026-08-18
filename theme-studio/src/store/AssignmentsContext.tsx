import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ThemeMode } from '../theme/mode';
import type { ChromeOverride } from '../theme/chrome';
import type { ImportedTheme } from '../theme/importTheme';

export type { ChromeOverride };

export const DEFAULT_THEME_NAME = 'My Theme';
const MAX_RECENT_COLORS = 12;

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
  /** Replaces the theme name, and the assignments/chrome for each mode an import produced — modes it didn't touch are left as-is. Also switches the active mode to the first imported variant. */
  importTheme: (theme: ImportedTheme) => void;
  /** Most-recently-used colors across both modes, newest first — a personal palette shortcut. */
  recentColors: string[];
  /** Everything this context owns, back to first-load defaults: mode, assignments, chrome overrides, theme name, recent colors. */
  resetAll: () => void;
}

const AssignmentsContext = createContext<AssignmentsContextValue | null>(null);

export function AssignmentsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [assignmentsByMode, setAssignmentsByMode] = useState<Record<ThemeMode, Map<string, string>>>(
    emptyAssignmentsByMode,
  );
  const [themeName, setThemeName] = useState(DEFAULT_THEME_NAME);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [chromeByMode, setChromeByMode] = useState<Record<ThemeMode, ChromeOverride>>(emptyChromeByMode);

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
    setAssignmentsByMode((prev) => {
      const next = { ...prev };
      for (const variant of theme.variants) next[variant.mode] = variant.assignments;
      return next;
    });
    setChromeByMode((prev) => {
      const next = { ...prev };
      for (const variant of theme.variants) next[variant.mode] = variant.chrome;
      return next;
    });
    setMode(theme.variants[0].mode);
  }, []);

  const resetAll = useCallback(() => {
    setMode('light');
    setAssignmentsByMode(emptyAssignmentsByMode());
    setChromeByMode(emptyChromeByMode());
    setThemeName(DEFAULT_THEME_NAME);
    setRecentColors([]);
  }, []);

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
    ],
  );

  return <AssignmentsContext.Provider value={value}>{children}</AssignmentsContext.Provider>;
}

export function useAssignments(): AssignmentsContextValue {
  const ctx = useContext(AssignmentsContext);
  if (!ctx) throw new Error('useAssignments must be used within AssignmentsProvider');
  return ctx;
}
