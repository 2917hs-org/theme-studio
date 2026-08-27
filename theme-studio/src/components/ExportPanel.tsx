import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssignments } from '../store/useAssignments';
import type { ThemeMode } from '../theme/mode';
import { buildVsixBlobSync, composeAutoThemeName, downloadBlob, slugify } from '../vsix/buildVsix';
import { detectOS, installCommandFor } from '../vsix/installCommand';
import {
  buildSingleFileExport,
  EXPORT_FORMATS,
  hasEnoughForSingleFileExport,
  isSingleFileFormat,
  type ExportFormatId,
} from '../export/exportFormats';
import { track } from '../analytics/track';
import { CheckCircleIcon, CopyIcon, ExportIcon } from './icons';

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
  // The real downloaded filename from the most recent successful export —
  // drives the install-command block below. Kept separate from `justExported`
  // (which is a brief "Downloaded" confirmation) since the command should
  // stay visible well after that fades, as long as it still matches the last
  // file actually saved.
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);
  const [justCopiedCommand, setJustCopiedCommand] = useState(false);
  const [copyCommandError, setCopyCommandError] = useState(false);
  // The browser doesn't change mid-session, so this only ever needs computing once.
  const [detectedOS] = useState(detectOS);
  const [format, setFormat] = useState<ExportFormatId>('vscode');

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

  // The non-VS Code targets (Windows Terminal, iTerm2, Zed) are single-file,
  // single-mode exports — unlike the VSIX's Dark+Light bundling, there's
  // nothing to merge across modes, so they always describe whatever the
  // *currently active* mode has colored.
  const currentAssignments = assignmentsFor(mode);
  const currentChrome = chromeFor(mode);
  const singleFileFormatReady = isSingleFileFormat(format) && hasEnoughForSingleFileExport(mode, currentAssignments, currentChrome);

  // Synchronous end to end — Safari only honors the anchor `download`
  // attribute on a blob: URL when the click that triggers it runs with no
  // async gap beforehand, so nothing here may sit behind an `await`.
  function buildCurrentVsix(): { blob: Blob; filename: string } {
    const variants = exportModes.map((m) => ({ mode: m, assignments: assignmentsFor(m), chrome: chromeFor(m) }));
    // The *friendly* label VS Code shows inside the theme itself
    // (package.json displayName, the picker entry) — deliberately separate
    // from the filename above, and still allowed to fall back to the raw
    // product name/'vsts' the way it always has; unlike the filename, nothing
    // requires this to look like a slug.
    const productComponent = (themeNameAutoTracked ? productThemeName : trimmedThemeName) || 'vsts';
    const blob = buildVsixBlobSync(productComponent, variants, pairedIconTheme);
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
    return { blob, filename };
  }

  function handleExport() {
    setExportError(null);
    setIsExporting(true);
    track('export_clicked');
    track('export_format', { format });
    try {
      const { blob, filename } = isSingleFileFormat(format)
        ? (() => {
            const { content, filename: singleFileName } = buildSingleFileExport(
              format,
              trimmedThemeName,
              mode,
              currentAssignments,
              currentChrome,
            );
            // Same opaque MIME buildVsix.ts uses for the VSIX itself — an
            // explicit `download` attribute already forces a save in every
            // evergreen browser, but Safari in particular is more reliable
            // with a MIME type it has no built-in viewer for.
            return { blob: new Blob([content], { type: 'application/octet-stream' }), filename: singleFileName };
          })()
        : buildCurrentVsix();
      downloadBlob(blob, filename);
      setJustExported(true);
      setLastExportedFilename(format === 'vscode' ? filename : null);
      setJustCopiedCommand(false);
      setCopyCommandError(false);
      // Only fires once the blob actually built and the download call ran —
      // never from the click alone, so a broken export doesn't inflate the
      // success count.
      track('export_completed');
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
      exportTimeoutRef.current = setTimeout(() => setJustExported(false), 2800);
    } catch (err) {
      console.error('Failed to generate export:', err);
      setExportError('Something went wrong generating the file. Please try again.');
      track('export_failed');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCopyInstallCommand() {
    if (!lastExportedFilename) return;
    const command = installCommandFor(detectedOS, lastExportedFilename);
    try {
      await navigator.clipboard.writeText(command);
      setJustCopiedCommand(true);
      setCopyCommandError(false);
      setTimeout(() => setJustCopiedCommand(false), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the command is already
      // shown as plain, selectable text below, so nothing is actually lost.
      setCopyCommandError(true);
    }
  }

  const singleFile = isSingleFileFormat(format);
  const currentModeHasAnyColor = currentAssignments.size > 0 || Boolean(currentChrome.background || currentChrome.foreground);
  const hasColors = singleFile ? currentModeHasAnyColor : modesToExport.length > 0;
  // Blocks export on a blank/whitespace-only name rather than letting
  // `slugify`'s own 'custom-theme' fallback silently kick in — that
  // fallback exists for callers outside this UI (tests, buildVsixBlobSync
  // used directly), not to hand someone a file named after nothing they
  // typed while the box in front of them still shows empty.
  const hasValidName = trimmedThemeName.length > 0;
  const canExport = singleFile ? hasColors && hasValidName && singleFileFormatReady : hasColors && hasValidName;
  const formatLabel = EXPORT_FORMATS.find((f) => f.id === format)?.label ?? format;
  const singleFileFilename =
    singleFile && hasValidName ? buildSingleFileExport(format, trimmedThemeName, mode, currentAssignments, currentChrome).filename : null;

  // Falls back to a "Custom Theme" label rather than leaving this row
  // blank — nothing was picked from Quick Start/Marketplace/Gallery, but
  // whatever's been hand-colored is still *a* theme worth naming as such.
  const displayProductThemeName = productThemeName ?? 'Custom Theme';
  const iconThemeLabel = pairedIconTheme ? pairedIconTheme.displayName : 'None';

  return (
    <>
      <div className="export-theme-summary">
        <div className="export-theme-summary-row">
          <span className="export-theme-summary-key">Product Theme</span>
          <span className="export-theme-summary-sep">:</span>
          <span className="export-theme-summary-value" title={displayProductThemeName}>
            {displayProductThemeName}
          </span>
        </div>
        <div className="export-theme-summary-row">
          <span className="export-theme-summary-key">Icon Theme</span>
          <span className="export-theme-summary-sep">:</span>
          <span className="export-theme-summary-value" title={iconThemeLabel}>
            {iconThemeLabel}
          </span>
        </div>
      </div>

      <label className="field-label">
        <div className="field-label-row">
          <span className="field-label-title">Format</span>
          <select
            className="export-format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormatId)}
            aria-label="Export format"
          >
            {EXPORT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </label>

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
        <span className={`field-hint${hasColors && (!hasValidName || (singleFile && !singleFileFormatReady)) ? ' field-hint-error' : ''}`}>
          {!hasColors
            ? 'Color at least one token to enable export.'
            : singleFile && !singleFileFormatReady
              ? `Color a few more tokens — a keyword, a string, a function — for a coherent ${formatLabel} palette.`
              : !hasValidName
                ? 'Give your theme a name to enable export.'
                : singleFile
                  ? `Exporting ${mode === 'dark' ? 'Dark' : 'Light'} as ${formatLabel} — whatever you've colored so far.`
                  : `Exporting ${exportModes.map((m) => (m === 'dark' ? 'Dark' : 'Light')).join(' + ')}${exportModes.length > 1 ? ' as one theme' : ''} — whatever you've colored so far.`}
        </span>
        {hasValidName && (
          <span className="field-hint export-filename-hint">
            Downloads as <span className="export-filename">{singleFile ? singleFileFilename : `${slugify(trimmedThemeName)}.vsix`}</span>
          </span>
        )}
        {!singleFile && pairedIconTheme && (
          <span className="field-hint">Also installs <b>{pairedIconTheme.displayName}</b> as a recommended icon theme.</span>
        )}
        <span className="field-hint">
          {format === 'vscode' && 'Go to VS Code: Extensions → "…" menu → Install from VSIX…'}
          {format === 'windows-terminal' && 'Paste the downloaded JSON into Windows Terminal\'s settings.json, inside the "schemes" array.'}
          {format === 'iterm2' && 'In iTerm2: Preferences → Profiles → Colors → Color Presets… → Import…, then select the downloaded file.'}
          {format === 'zed' && (
            <>
              In Zed: save the file to <span className="export-filename">~/.config/zed/themes/</span>, then pick it from the theme
              selector.
            </>
          )}
        </span>
      </div>

      {exportError && <div className="inspector-error">{exportError}</div>}

      {format === 'vscode' && lastExportedFilename && (
        <div className="install-command-block">
          <div className="install-command-label">Or install it with one command</div>
          <div className="install-command-row">
            <code className="install-command-code">{installCommandFor(detectedOS, lastExportedFilename)}</code>
            <button
              type="button"
              className="install-command-copy-btn"
              onClick={handleCopyInstallCommand}
              title="Copy install command"
              aria-label="Copy install command"
            >
              {justCopiedCommand ? <CheckCircleIcon size={13} /> : <CopyIcon size={13} />}
            </button>
          </div>
          {copyCommandError && (
            <span className="field-hint field-hint-error">Couldn't copy — select the command above instead.</span>
          )}
          <span className="field-hint">
            Assumes your browser saved the file to this OS's default Downloads folder — if yours is different, adjust
            the path. Requires the <span className="export-filename">code</span> CLI on PATH —{' '}
            <a
              href="https://code.visualstudio.com/docs/configure/command-line#_launching-from-command-line"
              target="_blank"
              rel="noreferrer noopener"
            >
              set it up here
            </a>{' '}
            if this doesn't run.
          </span>
        </div>
      )}
    </>
  );
}
