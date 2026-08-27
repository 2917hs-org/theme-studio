import { useAssignments } from '../store/useAssignments';
import { friendlyLabelFor } from '../data/scopeLabels';
import type { ThemeMode } from '../theme/mode';

const MODES = ['dark', 'light'] as const;

interface ColorGroup {
  color: string;
  scopes: string[];
}

// A preset (or an imported theme) fans one authored color out across many
// TextMate scopes — e.g. 8 different comment scopes all sharing one exact
// muted color. Listed scope-by-scope, that means the first several rows a
// user sees are all identical, which reads as "everything is the same
// grey" even though the palette underneath is fine. Grouping consecutive
// scopes that share a color keeps the list one row per *distinct* color —
// what someone assigned, not how many scopes it happened to expand into —
// and removing a group clears every scope it stands for.
export function groupByColor(assignments: Map<string, string>): ColorGroup[] {
  const order: string[] = [];
  const groups = new Map<string, ColorGroup>();
  for (const [scope, color] of assignments) {
    const key = color.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { color, scopes: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.scopes.push(scope);
  }
  return order.map((key) => groups.get(key)!);
}

/** Inventory of every scope colored so far, across both modes — independent of what's currently selected to export. */
export function AssignedColorsPanel() {
  const { assignmentsFor, clearColor, replaceAssignments } = useAssignments();

  const darkAssignments = assignmentsFor('dark');
  const lightAssignments = assignmentsFor('light');
  const totalCount = darkAssignments.size + lightAssignments.size;

  // Only this mode's colors — clearing Dark shouldn't touch what you've
  // already built for Light, and vice versa.
  function handleClearClick(m: ThemeMode) {
    replaceAssignments(m, new Map());
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

  const visibleModes = MODES.filter((m) => assignmentsFor(m).size > 0);

  return (
    <>
      {visibleModes.map((m) => {
        const modeAssignments = assignmentsFor(m);
        const groups = groupByColor(modeAssignments);
        return (
          <div className="assignments-summary" key={m}>
            <ul className="assignments-list">
              {groups.map(({ color, scopes }) => {
                const primaryScope = scopes[0];
                return (
                  <li key={color}>
                    <span className="swatch" style={{ background: color }} />
                    <span className="assignment-text">
                      <span className="assignment-label">{friendlyLabelFor(primaryScope) ?? primaryScope}</span>
                      <span className="assignment-scope" title={scopes.join(', ')}>
                        {scopes.length > 1 ? `${scopes.length} scopes, incl. ${primaryScope}` : primaryScope}
                      </span>
                    </span>
                    <button
                      className="remove-assignment-btn"
                      onClick={() => scopes.forEach((scope) => clearColor(scope, m))}
                      title={scopes.length > 1 ? `Remove (clears ${scopes.length} scopes)` : 'Remove'}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
              <li className="clear-all-row">
                <button className="clear-all-btn" onClick={() => handleClearClick(m)}>
                  Clear All
                </button>
              </li>
            </ul>
          </div>
        );
      })}
    </>
  );
}
