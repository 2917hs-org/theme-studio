import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssignments } from '../store/useAssignments';
import type { ThemeMode } from '../theme/mode';
import { buildVsixBlobSync, composeAutoThemeName, downloadBlob, slugify } from '../vsix/buildVsix';
import { CheckCircleIcon, ExportIcon } from './icons';

const MODES: ThemeMode[] = ['dark', 'light'];

export function ExportPanel() {
  const {
    mode,
    assignmentsFor,
    chromeFor,
    themeName,
    setThemeName,
    themeNameAutoTracked,
    setThemeNameAutoTracked,
    productThemeName,
    pairedIconTheme,
  } = useAssignments();
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
  // Only names the export after a mode when it actually ships just one —
  // computed from modesToExport (what's *really* colored), not the
  // exportModes fallback above, so an untouched, nothing-colored-yet state
  // doesn't misleadingly stamp a mode onto the still-empty default name.
  const modeSuffix = modesToExport.length === 1 ? modesToExport[0] : null;

  // The Theme name box auto-fills "vsts-[product theme]-[icon theme]-
  // [mode]" as each gets picked, but stays editable — the moment a
  // keystroke makes the field diverge from what was last auto-filled, this
  // stops touching it, so a custom name typed after the fact is never
  // silently clobbered by a later preset click or icon pairing.
  //
  // Whether the field is still auto-tracking lives in context
  // (`themeNameAutoTracked`), not as a ref comparing name strings here —
  // this used to infer "still tracking" from `themeName === <last auto
  // value>`, kept in a component-local ref. That broke across a Reset:
  // resetAll() clears `themeName`/`productThemeName` in context but has no
  // way to reach into this ref, so it went on holding the *pre-reset* auto
  // name. The next preset pick after a reset would then compare the
  // freshly-emptied `themeName` against that stale value, find a mismatch,
  // and skip the fill — the box just stayed blank from then on. A real
  // boolean flag that resetAll can set directly has no such staleness.
  const autoThemeName = composeAutoThemeName(productThemeName, pairedIconTheme, modeSuffix);
  useEffect(() => {
    if (themeNameAutoTracked) setThemeName(autoThemeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoThemeName, themeNameAutoTracked]);

  const trimmedThemeName = themeName.trim();

  // Synchronous end to end — Safari only honors the anchor `download`
  // attribute on a blob: URL when the click that triggers it runs with no
  // async gap beforehand, so nothing here may sit behind an `await`.
  function buildCurrentVsix(): { blob: Blob; bytes: Uint8Array; filename: string } {
    const variants = exportModes.map((m) => ({ mode: m, assignments: assignmentsFor(m), chrome: chromeFor(m) }));
    // The *friendly* label VS Code shows inside the theme itself
    // (package.json displayName, the picker entry) — deliberately separate
    // from the filename above, and still allowed to fall back to the raw
    // product name/'vsts' the way it always has; unlike the filename, nothing
    // requires this to look like a slug.
    const productComponent = (themeNameAutoTracked ? productThemeName : trimmedThemeName) || 'vsts';
    const { blob, bytes } = buildVsixBlobSync(productComponent, variants, pairedIconTheme);
    // Slugifies the box's *own* text directly, rather than re-deriving a
    // name from productThemeName/pairedIconTheme the way this used to —
    // that second derivation is exactly what let a custom-typed box value
    // and the downloaded file disagree: the box showed your literal text,
    // but the file was rebuilt from scratch out of the underlying
    // selection, silently dropping or reformatting whatever you'd actually
    // typed. This way the two can't drift apart — the file's base name IS
    // the box, always (see the "Downloads as…" hint below, which shows the
    // exact same computation).
    const filename = `${slugify(trimmedThemeName)}.vsix`;
    return { blob, bytes, filename };
  }

  function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      const { blob, bytes, filename } = buildCurrentVsix();
      downloadBlob({ blob, bytes }, filename);
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

  const hasColors = modesToExport.length > 0;
  // Blocks export on a blank/whitespace-only name rather than letting
  // `slugify`'s own 'custom-theme' fallback silently kick in — that
  // fallback exists for callers outside this UI (tests, buildVsixBlobSync
  // used directly), not to hand someone a file named after nothing they
  // typed while the box in front of them still shows empty.
  const hasValidName = trimmedThemeName.length > 0;
  const canExport = hasColors && hasValidName;

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
          onChange={(e) => {
            setThemeName(e.target.value);
            if (themeNameAutoTracked) setThemeNameAutoTracked(false);
          }}
          placeholder="e.g. Midnight Coder"
          aria-label="Theme name"
          aria-invalid={hasColors && !hasValidName}
          title={themeName || undefined}
          maxLength={60}
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
        <span className={`field-hint${hasColors && !hasValidName ? ' field-hint-error' : ''}`}>
          {!hasColors
            ? 'Color at least one token to enable export.'
            : !hasValidName
              ? 'Give your theme a name to enable export.'
              : `Exporting ${exportModes.map((m) => (m === 'dark' ? 'Dark' : 'Light')).join(' + ')}${exportModes.length > 1 ? ' as one theme' : ''} — whatever you've colored so far.`}
        </span>
        {hasValidName && (
          <span className="field-hint export-filename-hint">
            Downloads as <span className="export-filename">{slugify(trimmedThemeName)}.vsix</span>
          </span>
        )}
        {pairedIconTheme && (
          <span className="field-hint">Also installs <b>{pairedIconTheme.displayName}</b> as a recommended icon theme.</span>
        )}
        <span className="field-hint">Go to VS Code: Extensions → "…" menu → Install from VSIX…</span>
      </div>

      {exportError && <div className="inspector-error">{exportError}</div>}
    </>
  );
}
