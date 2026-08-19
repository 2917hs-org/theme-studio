import { useEffect, useRef, useState } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import { buildVsixBlob, downloadBlob, slugify } from '../vsix/buildVsix';
import { copyToClipboard, installCommandFor } from '../vsix/installLocal';
import { CheckCircleIcon, CopyIcon, ExportIcon, LaunchIcon } from './icons';

export function ExportPanel() {
  // Exports whichever mode the pinned ModeSwitcher above has active —
  // there's no separate export-scope choice, since you only ever design
  // one mode at a time.
  const { mode, assignments, chrome, themeName, setThemeName } = useAssignments();
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

  async function buildCurrentVsix(): Promise<{ blob: Blob; filename: string }> {
    const blob = await buildVsixBlob(themeName || 'My Theme', mode, assignments, chrome);
    const filename = `${slugify(themeName || 'My Theme')}.vsix`;
    return { blob, filename };
  }

  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      const { blob, filename } = await buildCurrentVsix();
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
      const { blob, filename } = await buildCurrentVsix();
      downloadBlob(blob, filename);
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

  const canExport = assignments.size > 0;

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
          </div>
        </div>
      )}

      <div className="export-hint">Or manually, in VS Code: Extensions → "…" menu → Install from VSIX…</div>
    </>
  );
}
