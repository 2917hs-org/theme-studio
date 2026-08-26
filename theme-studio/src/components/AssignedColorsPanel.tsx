import { useEffect, useRef, useState } from 'react';
import { useAssignments } from '../store/useAssignments';
import { friendlyLabelFor } from '../data/scopeLabels';
import { TrashIcon } from './icons';

const CLEAR_CONFIRM_TIMEOUT_MS = 3000;
const MODES = ['dark', 'light'] as const;

/** Inventory of every scope colored so far, across both modes — independent of what's currently selected to export. */
export function AssignedColorsPanel() {
  const { assignmentsFor, clearColor, clearAllColors } = useAssignments();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
  }, []);

  const darkAssignments = assignmentsFor('dark');
  const lightAssignments = assignmentsFor('light');
  const totalCount = darkAssignments.size + lightAssignments.size;

  function handleClearClick() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      clearTimeoutRef.current = setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
      return;
    }
    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    setConfirmingClear(false);
    clearAllColors();
  }

  if (totalCount === 0) {
    return (
      <div className="empty-state empty-state-compact">
        <div className="empty-state-body">
          No colors assigned yet — click a token in the editor, or apply a quick-start preset above.
        </div>
      </div>
    );
  }

  return (
    <>
      {MODES.map((m) => {
        const modeAssignments = assignmentsFor(m);
        if (modeAssignments.size === 0) return null;
        return (
          <div className="assignments-summary" key={m}>
            <div className="assignments-summary-title">
              <span className="assignments-mode-tag">{m === 'dark' ? 'Dark' : 'Light'}</span>
              {modeAssignments.size} scope{modeAssignments.size === 1 ? '' : 's'} colored
            </div>
            <ul className="assignments-list">
              {[...modeAssignments.entries()].map(([scope, color]) => (
                <li key={scope}>
                  <span className="swatch" style={{ background: color }} />
                  <span className="assignment-text">
                    <span className="assignment-label">{friendlyLabelFor(scope) ?? scope}</span>
                    <span className="assignment-scope" title={scope}>
                      {scope}
                    </span>
                  </span>
                  <button className="remove-assignment-btn" onClick={() => clearColor(scope, m)} title="Remove">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <button
        className={confirmingClear ? 'clear-all-btn clear-all-btn-confirming' : 'clear-all-btn'}
        onClick={handleClearClick}
        onBlur={() => setConfirmingClear(false)}
      >
        <TrashIcon size={12} />
        {confirmingClear ? 'Click again to clear both modes' : 'Clear all colors'}
      </button>
    </>
  );
}
