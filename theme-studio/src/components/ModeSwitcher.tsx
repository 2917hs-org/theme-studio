import type { ReactNode } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import type { ThemeMode } from '../theme/mode';
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
  const { mode, setMode, assignmentsFor } = useAssignments();

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
    </div>
  );
}
