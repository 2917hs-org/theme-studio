import { useEffect, useState, type ReactNode } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import type { ThemeMode } from '../theme/mode';
import { defaultBackgroundFor } from '../theme/baseline';
import { parseColorToHex } from '../theme/colorParse';
import { MoonIcon, SunIcon } from './icons';

const MODES: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
  { value: 'dark', label: 'Dark', icon: <MoonIcon size={13} /> },
  { value: 'light', label: 'Light', icon: <SunIcon size={13} /> },
];

/**
 * Pinned above every collapsible section. Dark/Light only, on purpose — you
 * design one theme at a time (Monaco can only preview one), so there's
 * nothing for a "Both" option to mean here beyond confusing the single
 * "what am I working on" decision this control makes. Picking a mode sets
 * what you're actively coloring, the live preview above, and what the
 * Export section will bundle — all three follow this one choice.
 */
export function ModeSwitcher() {
  const { mode, setMode, assignmentsFor, chrome, setChrome } = useAssignments();
  const [draft, setDraft] = useState(chrome.background ?? '');
  const [error, setError] = useState<string | null>(null);

  // Resyncs the draft text field when the active mode changes (Dark and
  // Light each have their own background override) or when the background
  // is changed from elsewhere (e.g. a preset or an imported theme).
  useEffect(() => {
    setDraft(chrome.background ?? '');
    setError(null);
  }, [mode, chrome.background]);

  function commit(hex: string) {
    setError(null);
    setChrome(mode, { background: hex });
  }

  // Applies the moment what's typed becomes a valid color, instead of
  // waiting for blur/Enter — same as the token color inputs in Inspect token.
  function handleDraftChange(value: string) {
    setDraft(value);
    const hex = parseColorToHex(value);
    if (hex) commit(hex);
  }

  function handleDraftFinish() {
    if (!draft) return;
    if (!parseColorToHex(draft)) {
      setError('Enter a hex (#aabbcc), rgb(), or hsl() color');
    }
  }

  return (
    <div className="pinned-controls">
      <div className="field-label">
        Mode
        <div className="mode-toggle mode-toggle-full" role="radiogroup" aria-label="Mode you're coloring — also sets the live preview and what gets exported">
          {MODES.map((m) => {
            const count = assignmentsFor(m.value).size;
            return (
              <button
                key={m.value}
                role="radio"
                aria-checked={mode === m.value}
                className={mode === m.value ? 'mode-toggle-btn mode-toggle-btn-active' : 'mode-toggle-btn'}
                onClick={() => setMode(m.value)}
              >
                {m.icon} {m.label}
                {count > 0 && <span className="mode-toggle-count">{count}</span>}
              </button>
            );
          })}
        </div>
        <span className="field-hint">Sets what you're coloring below, and what gets exported.</span>
      </div>

      <div className="field-label">
        Background color
        <div className="color-controls">
          <input
            type="color"
            className="color-native-input"
            value={defaultBackgroundFor(mode, chrome)}
            onChange={(e) => commit(e.target.value)}
            title="OS color picker (also supports the eyedropper tool in some browsers)"
            aria-label={`Pick the ${mode} mode code snippet's background color`}
          />
          <input
            type="text"
            className="color-text-input"
            placeholder="#rrggbb, rgb(), or hsl()"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={handleDraftFinish}
            onKeyDown={(e) => e.key === 'Enter' && handleDraftFinish()}
            aria-label={`Type a hex, rgb(), or hsl() background color for ${mode} mode`}
          />
          {chrome.background && (
            <button className="clear-color-btn" onClick={() => setChrome(mode, { background: undefined })}>
              Reset
            </button>
          )}
        </div>
        <span className="field-hint">The code snippet's own background — separate from your OS/browser theme.</span>
        {error && <div className="inspector-error">{error}</div>}
      </div>
    </div>
  );
}
