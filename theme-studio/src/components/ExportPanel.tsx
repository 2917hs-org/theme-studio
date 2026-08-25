import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import type { ThemeMode } from '../theme/mode';
import { buildExportSlug, buildVsixBlobSync, downloadBlob } from '../vsix/buildVsix';
import { copyToClipboard, installCommandFor } from '../vsix/installLocal';
import { CheckCircleIcon, CopyIcon, ExportIcon, LaunchIcon } from './icons';

const MODES: ThemeMode[] = ['dark', 'light'];

export function ExportPanel() {
  const { mode, assignmentsFor, chromeFor, themeName, setThemeName, pairedIconTheme } = useAssignments();
  const [justExported, setJustExported] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<{ filename: string; command: string; copied: boolean } | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
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

  // Synchronous end to end — Safari only honors the anchor `download`
  // attribute on a blob: URL when the click that triggers it runs with no
  // async gap beforehand, so nothing here may sit behind an `await`.
  function buildCurrentVsix(): { blob: Blob; filename: string } {
    const variants = exportModes.map((m) => ({ mode: m, assignments: assignmentsFor(m), chrome: chromeFor(m) }));
    const blob = buildVsixBlobSync(themeName || 'My Theme', variants, pairedIconTheme);
    const filename = `${buildExportSlug(themeName || 'My Theme', pairedIconTheme)}.vsix`;
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

  async function handleInstallToVSCode() {
    setExportError(null);
    setIsInstalling(true);
    setInstallInfo(null);
    try {
      const { blob, filename } = buildCurrentVsix();
      downloadBlob(blob, filename);
      // Clipboard write happens after the click has already fired, so an
      // await here doesn't touch Safari's gesture requirement above.
      const command = installCommandFor(filename);
      const copied = await copyToClipboard(command);
      setInstallInfo({ filename, command, copied });
    } catch (err) {
      console.error('Failed to package theme for install:', err);
      setExportError('Something went wrong preparing the install. Please try again.');
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleCopyCommand() {
    if (!installInfo) return;
    const copied = await copyToClipboard(installInfo.command);
    setInstallInfo({ ...installInfo, copied });
  }

  const canExport = modesToExport.length > 0;

  return (
    <>
      <div className="field-label">
        Theme name
        <input
          type="text"
          className="export-name-input"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          placeholder="e.g. Midnight Coder"
          aria-label="Theme name"
        />
        <span className="field-hint">
          {canExport
            ? `Exporting ${exportModes.map((m) => (m === 'dark' ? 'Dark' : 'Light')).join(' + ')}${exportModes.length > 1 ? ' as one theme' : ''} — whatever you've colored so far.`
            : "Color at least one token to enable export."}
        </span>
        {pairedIconTheme ? (
          <span className="field-hint">Also installs <b>{pairedIconTheme.displayName}</b> as a recommended icon theme.</span>
        ) : (
          <span className="field-hint">Tip: pair an icon theme in the section above so file icons match too.</span>
        )}
      </div>

      <div className="export-actions">
        <button
          className="export-btn"
          onClick={handleExport}
          disabled={!canExport || isExporting || isInstalling}
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
        <button
          className="install-btn"
          onClick={handleInstallToVSCode}
          disabled={!canExport || isInstalling || isExporting}
          title="Downloads the theme and gives you the one-line command to install it"
        >
          <LaunchIcon size={15} /> {isInstalling ? 'Preparing…' : 'Get install command'}
        </button>
      </div>

      {exportError && <div className="inspector-error">{exportError}</div>}

      {installInfo && (
        <div className="install-status install-status-success">
          <CheckCircleIcon size={13} />
          <div className="install-status-body">
            <span>
              Downloaded <b>{installInfo.filename}</b>. Run this in a terminal to install it
              {installInfo.copied ? ' — already copied to your clipboard:' : ':'}
            </span>
            <div className="install-command-row">
              <code className="install-command">{installInfo.command}</code>
              <button type="button" className="install-command-copy-btn" onClick={handleCopyCommand} title="Copy command">
                <CopyIcon size={13} />
                {installInfo.copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {!installInfo.copied && (
              // Clipboard writes can be silently denied (locked-down browser
              // permissions, an embedded/insecure context, ...) — the button
              // above just reverting to "Copy" with no explanation leaves
              // someone thinking it worked. Only shows once a copy has
              // actually been attempted (see copyToClipboard in
              // vsix/installLocal.ts), never before that first attempt.
              <span className="install-copy-hint">Couldn't copy automatically — select the command above and copy it yourself.</span>
            )}
          </div>
        </div>
      )}

      <div className="export-hint">Or manually, in VS Code: Extensions → "…" menu → Install from VSIX…</div>
    </>
  );
}
