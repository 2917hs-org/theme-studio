const STORAGE_KEY = 'theme-studio:tour-dismissed:v1';

/** Whether the user has opted out of the first-visit guided tour. Never throws — a missing, disabled, or corrupted store just means the tour keeps showing, which is the safe default (worst case: an already-familiar user sees it once more). */
export function hasTourBeenDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Fails silently — same as the theme autosave, this is a convenience, not a guarantee. A full quota or disabled storage just means the checkbox won't stick past this session. */
export function dismissTour(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}
