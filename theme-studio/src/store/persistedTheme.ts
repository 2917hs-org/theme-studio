import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';
import type { PairedIconTheme } from '../marketplace/searchMarketplace';

const STORAGE_KEY = 'theme-studio:autosave:v1';
// A session left untouched this long is treated as abandoned — the next
// visit starts fresh rather than resuming a stale draft.
const SESSION_TTL_MS = 60 * 60 * 1000;

export interface PersistedTheme {
  version: 1;
  mode: ThemeMode;
  themeName: string;
  assignments: Partial<Record<ThemeMode, Array<[string, string]>>>;
  chrome: Partial<Record<ThemeMode, ChromeOverride>>;
  /** Optional — absent in sessions saved before pairing existed, and `isValid` doesn't require it, so those restore fine with no pairing. */
  pairedIconTheme?: PairedIconTheme | null;
}

interface StoredEnvelope {
  savedAt: number;
  state: PersistedTheme;
}

function isValidState(v: unknown): v is PersistedTheme {
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

function isValidEnvelope(v: unknown): v is StoredEnvelope {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.savedAt === 'number' && isValidState(p.state);
}

/**
 * Reads the autosaved session, if any. Never throws — a missing, disabled,
 * or corrupted store just means starting fresh. A session older than
 * SESSION_TTL_MS is treated the same way — stale drafts are discarded
 * rather than resumed.
 */
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
    if (!isValidEnvelope(parsed)) return null;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      clearPersistedTheme();
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

/** Fails silently — autosave is a convenience, not a guarantee, so a full quota or disabled storage shouldn't surface an error to the user. */
export function savePersistedTheme(state: PersistedTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
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
