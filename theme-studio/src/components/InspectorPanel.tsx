import { useEffect, useState } from 'react';
import type { ScopeResolution } from '../data/scopeLabels';
import { useAssignments } from '../store/AssignmentsContext';
import { parseColorToHex, contrastRatio } from '../theme/colorParse';
import { baselineColorsFor, defaultForegroundFor } from '../theme/baseline';
import { quickPalette, widePalette } from '../theme/palette';
import { CursorClickIcon, BanIcon, ChevronIcon } from './icons';
import { ColorPicker } from './ColorPicker';

interface InspectorPanelProps {
  selection: { text: string; resolution: ScopeResolution } | null;
}

export function InspectorPanel({ selection }: InspectorPanelProps) {
  const { assignments, setColor, clearColor, mode, chrome, recentColors } = useAssignments();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showScopeDetails, setShowScopeDetails] = useState(false);

  const scope = selection?.resolution.scope ?? null;
  const currentColor = scope ? assignments.get(scope) : undefined;

  useEffect(() => {
    setDraft(currentColor ?? '');
    setError(null);
  }, [scope, currentColor]);

  if (!selection) {
    return (
      <div className="empty-state">
        <CursorClickIcon className="empty-state-icon" />
        <div className="empty-state-title">Nothing selected</div>
        <div className="empty-state-body">Click any token in the editor to inspect its real TextMate category.</div>
      </div>
    );
  }

  const { resolution } = selection;

  if (!resolution.colorable) {
    return (
      <>
        <div className="inspector-token">"{selection.text}"</div>
        <div className="empty-state empty-state-compact">
          <BanIcon className="empty-state-icon empty-state-icon-muted" size={22} />
          <div className="empty-state-body">
            This token has no distinct TextMate scope beyond the file's default text — it isn't independently
            colorable.
          </div>
        </div>
      </>
    );
  }

  function commit(value: string) {
    const hex = parseColorToHex(value);
    if (!hex) {
      setError('Enter a hex (#aabbcc), rgb(), or hsl() color');
      return;
    }
    setError(null);
    setColor(scope!, hex);
  }

  // Applies the moment what's typed becomes a valid color, instead of
  // waiting for blur/Enter — typing a hex should feel direct. Invalid or
  // still-incomplete input (e.g. "#12") just doesn't apply yet; it only
  // becomes an error if the user finishes typing (blur/Enter) on something
  // that never resolved to a real color.
  function handleDraftChange(value: string) {
    setDraft(value);
    const hex = parseColorToHex(value);
    if (hex) {
      setError(null);
      setColor(scope!, hex);
    }
  }

  function handleDraftFinish() {
    if (!draft) return;
    if (!parseColorToHex(draft)) {
      setError('Enter a hex (#aabbcc), rgb(), or hsl() color');
    }
  }

  const ratio = currentColor ? contrastRatio(currentColor, baselineColorsFor(mode, chrome)['editor.background']) : null;
  const otherRecentColors = recentColors.filter((c) => c.toLowerCase() !== currentColor?.toLowerCase());

  return (
    <>
      <div className="inspector-token">"{selection.text}"</div>
      <div className="inspector-label">{resolution.label}</div>
      {!resolution.isFriendly && <div className="inspector-raw-note">No curated label — showing the raw scope.</div>}

      <button
        type="button"
        className="scope-details-toggle"
        onClick={() => setShowScopeDetails((v) => !v)}
        aria-expanded={showScopeDetails}
      >
        <ChevronIcon size={11} className={showScopeDetails ? 'scope-details-chevron scope-details-chevron-open' : 'scope-details-chevron'} />
        {showScopeDetails ? 'Hide' : 'Show'} technical scope details
      </button>

      {showScopeDetails && (
        <>
          <div className="scope-breadcrumb">
            {resolution.scopeChain.map((s, i) => (
              <span key={i} className="scope-crumb-wrap">
                {i > 0 && <span className="scope-crumb-sep">›</span>}
                <span className={i === resolution.scopeChain.length - 1 ? 'scope-crumb scope-crumb-deepest' : 'scope-crumb'}>
                  {s}
                </span>
              </span>
            ))}
          </div>

          <div className="inspector-warning">
            Assigning a color here affects every token — in this document and any other — whose scope falls under{' '}
            <b>{resolution.scope}</b>, not just this one occurrence.
          </div>
        </>
      )}

      <ColorPicker key={`${mode}-${scope}`} value={currentColor ?? defaultForegroundFor(mode, chrome)} onChange={commit} />
      <div className="picker-kbd-hint">Tab to focus, then arrow keys to fine-tune</div>

      <div className="field-label">
        Hex code
        <div className="color-controls">
          <input
            type="color"
            className="color-native-input"
            value={currentColor ?? defaultForegroundFor(mode, chrome)}
            onChange={(e) => commit(e.target.value)}
            title="OS color picker (also supports the eyedropper tool in some browsers)"
            aria-label="Pick a custom color with the OS picker"
          />
          <input
            type="text"
            className="color-text-input"
            placeholder="#rrggbb, rgb(), or hsl()"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onBlur={handleDraftFinish}
            onKeyDown={(e) => e.key === 'Enter' && handleDraftFinish()}
            aria-label="Type a hex, rgb(), or hsl() color"
          />
          {currentColor && (
            <button className="clear-color-btn" onClick={() => clearColor(scope!)}>
              Reset
            </button>
          )}
        </div>
        <span className="field-hint">Also accepts rgb() and hsl().</span>
      </div>
      {error && <div className="inspector-error">{error}</div>}

      {otherRecentColors.length > 0 && (
        <div className="swatch-row">
          <div className="swatch-row-label">Recently used</div>
          <div className="quick-palette">
            {otherRecentColors.map((c) => (
              <button
                key={c}
                className="quick-swatch"
                style={{ background: c }}
                onClick={() => commit(c)}
                title={c}
                aria-label={`Use ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="swatch-row">
        <div className="swatch-row-label">Suggested</div>
        <div className="quick-palette">
          {quickPalette().map((c) => (
            <button
              key={c}
              className={c.toLowerCase() === currentColor?.toLowerCase() ? 'quick-swatch quick-swatch-active' : 'quick-swatch'}
              style={{ background: c }}
              onClick={() => commit(c)}
              title={c}
              aria-label={`Use ${c}`}
              aria-pressed={c.toLowerCase() === currentColor?.toLowerCase()}
            />
          ))}
        </div>
      </div>

      <div className="swatch-row">
        <div className="swatch-row-label">More colors</div>
        <div className="quick-palette quick-palette-wide">
          {widePalette().map((c) => (
            <button
              key={c}
              className={c.toLowerCase() === currentColor?.toLowerCase() ? 'quick-swatch quick-swatch-active' : 'quick-swatch'}
              style={{ background: c }}
              onClick={() => commit(c)}
              title={c}
              aria-label={`Use ${c}`}
              aria-pressed={c.toLowerCase() === currentColor?.toLowerCase()}
            />
          ))}
        </div>
      </div>

      {ratio !== null && ratio < 4.5 && (
        <div className="contrast-warning">
          ⚠ Contrast ratio {ratio.toFixed(2)}:1 against the editor background — below the WCAG AA minimum of 4.5:1
          for body text. This color may be hard to read.
        </div>
      )}
    </>
  );
}
