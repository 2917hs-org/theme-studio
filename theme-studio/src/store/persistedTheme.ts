import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';

const STORAGE_KEY = 'theme-studio:autosave:v1';

export interface PersistedTheme {
  version: 1;
  mode: ThemeMode;
  themeName: string;
  assignments: Partial<Record<ThemeMode, Array<[string, string]>>>;
  chrome: Partial<Record<ThemeMode, ChromeOverride>>;
}

function isValid(v: unknown): v is PersistedTheme {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    p.version === 1 &&
    (p.mode === 'dark' || p.mode === 'light') &&
    typeof p.themeName === 'string' &&
    typeof p.assignments === 'object' &&
    p.assignments !== null &&
    typeof p.chrome === 'object' &&
    p.chrome !== null
  );
}

/** Reads the autosaved session, if any. Never throws — a missing, disabled, or corrupted store just means starting fresh. */
export function loadPersistedTheme(): PersistedTheme | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage unavailable — private browsing, disabled storage, etc.
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Fails silently — autosave is a convenience, not a guarantee, so a full quota or disabled storage shouldn't surface an error to the user. */
export function savePersistedTheme(state: PersistedTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function clearPersistedTheme(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Whether a restored session actually has anything worth telling the user about, as opposed to an empty-but-present record. */
export function hasMeaningfulContent(state: PersistedTheme): boolean {
  const darkEntries = state.assignments.dark ?? [];
  const lightEntries = state.assignments.light ?? [];
  const darkChrome = state.chrome.dark ?? {};
  const lightChrome = state.chrome.light ?? {};
  return (
    darkEntries.length > 0 ||
    lightEntries.length > 0 ||
    Boolean(darkChrome.background || darkChrome.foreground || lightChrome.background || lightChrome.foreground)
  );
}
