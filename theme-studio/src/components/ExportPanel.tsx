import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAssignments } from '../store/AssignmentsContext';
import { buildVsixBlob, downloadBlob, slugify, type ExportSelection } from '../vsix/buildVsix';
import { copyToClipboard, installCommandFor } from '../vsix/installLocal';
import { friendlyLabelFor } from '../data/scopeLabels';
import { ExportIcon, CheckCircleIcon, ContrastIcon, CopyIcon, LaunchIcon, MoonIcon, SunIcon, TrashIcon } from './icons';

// This is the only Dark/Light control in the app — there's no separate
// "editing mode" toggle elsewhere. Picking Dark or Light here both sets
// which variant(s) get exported *and* switches the live editor/app theme
// to match, so coloring and exporting always agree on what you're looking
// at. "Both" only affects export scope; it leaves the live preview as-is.
const EXPORT_OPTIONS: Array<{ value: ExportSelection; label: string; icon: ReactNode }> = [
  { value: 'dark', label: 'Dark', icon: <MoonIcon size={13} /> },
  { value: 'light', label: 'Light', icon: <SunIcon size={13} /> },
  { value: 'both', label: 'Both', icon: <ContrastIcon size={13} /> },
];

const CLEAR_CONFIRM_TIMEOUT_MS = 3000;

export function ExportPanel() {
  const { assignmentsFor, chromeFor, themeName, setThemeName, clearColor, clearAllColors, setMode } = useAssignments();
  const [exportSelection, setExportSelection] = useState<ExportSelection>('both');
  const [justExported, setJustExported] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<{ filename: string; command: string; copied: boolean } | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const darkAssignments = assignmentsFor('dark');
  const lightAssignments = assignmentsFor('light');
  const modesToShow = exportSelection === 'both' ? (['dark', 'light'] as const) : ([exportSelection] as const);
  const totalCount = darkAssignments.size + lightAssignments.size;

  useEffect(
    () => () => {
      if (exportTimeoutRef.current) clearTimeout(exportTimeoutRef.current);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    },
    [],
  );

  async function buildCurrentVsix(): Promise<{ blob: Blob; filename: string }> {
    const blob = await buildVsixBlob(
      themeName || 'My Theme',
      { dark: darkAssignments, light: lightAssignments },
      exportSelection,
      { dark: chromeFor('dark'), light: chromeFor('light') },
    );
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

  function handleSelectVariant(value: ExportSelection) {
    setExportSelection(value);
    // "Both" describes export scope only — the live preview can only ever
    // show one theme at a time, so leave it on whatever it's already showing.
    if (value !== 'both') setMode(value);
  }

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

  const canExport = modesToShow.some((m) => assignmentsFor(m).size > 0);

  return (
    <div className="panel-section">
      <div className="panel-section-header">
        <ExportIcon size={15} />
        <span>Export theme</span>
      </div>

      <div className="field-label">
        Variants to export
        <div className="mode-toggle mode-toggle-full" role="radiogroup" aria-label="Variants to export">
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={exportSelection === opt.value}
              className={exportSelection === opt.value ? 'mode-toggle-btn mode-toggle-btn-active' : 'mode-toggle-btn'}
              onClick={() => handleSelectVariant(opt.value)}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        <span className="field-hint">Dark and Light also switch the live preview above.</span>
      </div>

      {modesToShow.map((m) => {
        const modeAssignments = assignmentsFor(m);
        return (
          <div className="assignments-summary" key={m}>
            <div className="assignments-summary-title">
              {exportSelection === 'both' && <span className="assignments-mode-tag">{m === 'dark' ? 'Dark' : 'Light'}</span>}
              {modeAssignments.size === 0
                ? 'No colors assigned yet'
                : `${modeAssignments.size} scope${modeAssignments.size === 1 ? '' : 's'} colored`}
              {modeAssignments.size === 0 && exportSelection === 'both' && (
                <span className="assignments-summary-hint"> — will export with theme defaults</span>
              )}
            </div>
            {modeAssignments.size > 0 && (
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
            )}
          </div>
        );
      })}

      {totalCount > 0 && (
        <button
          className={confirmingClear ? 'clear-all-btn clear-all-btn-confirming' : 'clear-all-btn'}
          onClick={handleClearClick}
          onBlur={() => setConfirmingClear(false)}
        >
          <TrashIcon size={12} />
          {confirmingClear ? 'Click again to clear both modes' : 'Clear all colors'}
        </button>
      )}

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
          disabled={!canExport || totalCount === 0 || isExporting || isInstalling}
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
          disabled={!canExport || totalCount === 0 || isInstalling || isExporting}
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
    </div>
  );
}
