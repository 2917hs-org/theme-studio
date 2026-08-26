import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import type { ThemeMode } from '../theme/mode';
import { buildExportSlug, buildVsixBlobSync, composeAutoThemeName, downloadBlob } from '../vsix/buildVsix';
import { CheckCircleIcon, ExportIcon } from './icons';

const MODES: ThemeMode[] = ['dark', 'light'];

export function ExportPanel() {
  const { mode, assignmentsFor, chromeFor, themeName, setThemeName, productThemeName, pairedIconTheme } = useAssignments();
  const [justExported, setJustExported] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
    },
    [],
  );

  // The Theme name box auto-fills "vsts-[product theme]-[icon theme]" as
  // each gets picked, but stays editable — the moment a keystroke makes the
  // field diverge from what was last auto-filled, this stops touching it,
  // so a custom name typed after the fact is never silently clobbered by a
  // later preset click or icon pairing.
  //
  // Deliberately keyed only on `autoThemeName`, not `themeName` — reacting
  // to every keystroke was the original (buggy) version of this: clearing
  // the field to retype something new made `themeName === ''` true for one
  // render, which force-refilled the auto value *before* the next
  // keystroke landed, so a fresh custom name got typed onto the end of the
  // old one instead of replacing it. Restricting this to only run when the
  // selection itself changes means ordinary typing (including clearing the
  // field) never triggers it at all — `themeName` is still read fresh
  // inside the effect each time it *does* run, since a render always sees
  // current state regardless of another effect's dependency list.
  const autoThemeName = composeAutoThemeName(productThemeName, pairedIconTheme);
  const lastAutoNameRef = useRef<string | null>(null);
  useEffect(() => {
    const previousAuto = lastAutoNameRef.current;
    lastAutoNameRef.current = autoThemeName;
    // First run ever (mount): only claim a genuinely untouched field — a
    // name restored from a previous session is real, typed content, never
    // overwritten just because nothing's "selected" yet in this session.
    if (previousAuto === null) {
      if (themeName === '') setThemeName(autoThemeName);
      return;
    }
    if (themeName === previousAuto) setThemeName(autoThemeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoThemeName]);

  // Bundles every mode with real content into one .vsix — Dark and Light
  // are designed as a pair everywhere else in this app (the mode switcher,
  // the assignments panel), so the export shouldn't quietly drop whichever
  // one isn't currently active. A mode with no scope colors and no
  // background/foreground override contributes nothing worth shipping, so
  // it's left out rather than exported as an untouched default.
  const modesToExport = useMemo(
    () =>
      MODES.filter((m) => {
        const c = chromeFor(m);
        return assignmentsFor(m).size > 0 || Boolean(c.background || c.foreground);
      }),
    [assignmentsFor, chromeFor],
  );
  // Falls back to the active mode alone only if neither has anything yet —
  // canExport below already keeps the export buttons disabled in that case.
  const exportModes = modesToExport.length > 0 ? modesToExport : [mode];

  // Synchronous end to end — Safari only honors the anchor `download`
  // attribute on a blob: URL when the click that triggers it runs with no
  // async gap beforehand, so nothing here may sit behind an `await`.
  function buildCurrentVsix(): { blob: Blob; filename: string } {
    const variants = exportModes.map((m) => ({ mode: m, assignments: assignmentsFor(m), chrome: chromeFor(m) }));
    // While the box is still auto-tracking, feed buildExportSlug the *raw*
    // product name (e.g. "Midnight") rather than the already-composed
    // "vsts-midnight-..." string sitting in the box — otherwise the icon
    // segment would get appended a second time. Once the user has typed
    // something of their own, that text becomes the product component
    // instead, and buildExportSlug still wraps it in "vsts-...-[icon]" so a
    // custom rename never loses the icon-pairing signal from the filename.
    const isAutoTracking = themeName === autoThemeName;
    const productComponent = (isAutoTracking ? productThemeName : themeName) || 'vsts';
    const blob = buildVsixBlobSync(productComponent, variants, pairedIconTheme);
    const filename = `${buildExportSlug(productComponent, pairedIconTheme)}.vsix`;
    return { blob, filename };
  }

  function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      const { blob, filename } = buildCurrentVsix();
      downloadBlob(blob, filename);
      setJustExported(true);
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
      exportTimeoutRef.current = setTimeout(() => setJustExported(false), 2800);
    } catch (err) {
      console.error('Failed to generate VSIX:', err);
      setExportError('Something went wrong generating the file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  const canExport = modesToExport.length > 0;

  return (
    <>
      {(productThemeName || pairedIconTheme) && (
        <div className="export-selected-themes">
          {productThemeName && (
            <span className="export-selected-chip">
              <span className="export-selected-chip-kind">Theme</span> {productThemeName}
            </span>
          )}
          {pairedIconTheme && (
            <span className="export-selected-chip">
              <span className="export-selected-chip-kind">Icons</span> {pairedIconTheme.displayName}
            </span>
          )}
        </div>
      )}

      <div className="export-actions">
        <input
          type="text"
          className="export-name-input"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          placeholder="e.g. Midnight Coder"
          aria-label="Theme name"
          title={themeName || undefined}
        />
        <button
          className="export-btn"
          onClick={handleExport}
          disabled={!canExport || isExporting}
        >
          {justExported ? (
            <>
              <CheckCircleIcon size={15} /> Downloaded
            </>
          ) : (
            <>
              <ExportIcon size={15} /> {isExporting ? 'Building…' : 'Download theme'}
            </>
          )}
        </button>
      </div>

      <div className="export-hints">
        <span className="field-hint">
          {canExport
            ? `Exporting ${exportModes.map((m) => (m === 'dark' ? 'Dark' : 'Light')).join(' + ')}${exportModes.length > 1 ? ' as one theme' : ''} — whatever you've colored so far.`
            : "Color at least one token to enable export."}
        </span>
        {pairedIconTheme && (
          <span className="field-hint">Also installs <b>{pairedIconTheme.displayName}</b> as a recommended icon theme.</span>
        )}
        <span className="field-hint">Go to VS Code: Extensions → "…" menu → Install from VSIX…</span>
      </div>

      {exportError && <div className="inspector-error">{exportError}</div>}
    </>
  );
}
