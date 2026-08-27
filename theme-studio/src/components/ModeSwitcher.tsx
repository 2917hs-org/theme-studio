import { useEffect, useState } from 'react';
import { useAssignments } from '../store/useAssignments';
import type { ThemeMode } from '../theme/mode';
import { defaultBackgroundFor } from '../theme/baseline';
import { parseColorToHex, relativeLuminance } from '../theme/colorParse';

/**
 * Pinned above every collapsible section. Just the background color — which
 * mode that implies (dark vs light) is inferred from the color itself, not
 * picked explicitly, so there's no separate toggle to keep in sync.
 */
export function ModeSwitcher() {
  const { mode, setMode, chrome, setChrome } = useAssignments();
  const [draft, setDraft] = useState(chrome.background ?? '');
  const [error, setError] = useState<string | null>(null);

  // Resyncs the draft text field when the active mode changes (Dark and
  // Light each have their own background override) or when the background
  // is changed from elsewhere (e.g. a preset or an imported theme).
  useEffect(() => {
    setDraft(chrome.background ?? '');
    setError(null);
  }, [mode, chrome.background]);

  // A background color implies a mode — dark swatches build the dark
  // variant, light ones the light variant. There's no separate toggle for
  // this; the color you pick here is the only signal.
  function commit(hex: string) {
    setError(null);
    const impliedMode: ThemeMode = relativeLuminance(hex) < 0.5 ? 'dark' : 'light';
    if (impliedMode !== mode) setMode(impliedMode);
    setChrome(impliedMode, { background: hex });
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
    <div id="tour-mode-switcher" className="pinned-controls">
      <div className="field-label">
        <div className="field-label-row">
          <span className="field-label-title">Background color</span>
          <div className="color-controls">
            <input
              type="color"
              className="color-native-input"
              value={defaultBackgroundFor(mode, chrome)}
              onChange={(e) => commit(e.target.value)}
              title="OS color picker (also supports the eyedropper tool in some browsers)"
              aria-label="Pick the code snippet's background color"
            />
            <input
              type="text"
              className="color-text-input"
              placeholder="#rrggbb, rgb(), or hsl()"
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={handleDraftFinish}
              onKeyDown={(e) => e.key === 'Enter' && handleDraftFinish()}
              aria-label="Type a hex, rgb(), or hsl() background color"
            />
            {chrome.background && (
              <button className="clear-color-btn" onClick={() => setChrome(mode, { background: undefined })}>
                Reset
              </button>
            )}
          </div>
        </div>
        <span className="field-hint">The code snippet's own background — separate from your OS/browser theme.</span>
        {error && <div className="inspector-error">{error}</div>}
      </div>
    </div>
  );
}
