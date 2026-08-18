import { useRef, useState, type ChangeEvent } from 'react';
import { THEME_PRESETS, PRESET_SCOPES, type ThemePreset } from '../theme/presets';
import { useAssignments } from '../store/AssignmentsContext';
import { importThemeFile, ImportError, type ImportedTheme } from '../theme/importTheme';
import { ConfirmDialog } from './ConfirmDialog';
import { UploadIcon } from './icons';

interface PresetPickerProps {
  /** Reports a human-readable success message after a theme is imported, so the caller can surface it (e.g. as a toast). */
  onImported?: (message: string) => void;
}

export function PresetPicker({ onImported }: PresetPickerProps) {
  const { setMode, setChrome, setColor, clearColor, assignmentsFor, chromeFor, importTheme } = useAssignments();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedTheme | null>(null);

  function applyPreset(preset: ThemePreset) {
    setMode(preset.mode);
    setChrome(preset.mode, { background: preset.background, foreground: preset.text });
    setColor(PRESET_SCOPES.comments, preset.comments, preset.mode);
    setColor(PRESET_SCOPES.keywords, preset.keywords, preset.mode);
    setColor(PRESET_SCOPES.strings, preset.strings, preset.mode);
    setColor(PRESET_SCOPES.functions, preset.functions, preset.mode);
    // Applying a preset is a clean swap to exactly what it defines, not a
    // merge — a preset with no numbers color clears any prior assignment
    // instead of leaving a leftover from whatever was set before.
    if (preset.numbers) setColor(PRESET_SCOPES.numbers, preset.numbers, preset.mode);
    else clearColor(PRESET_SCOPES.numbers, preset.mode);
  }

  function describeVariants(theme: ImportedTheme): string {
    return theme.variants.length === 2 ? 'dark & light' : theme.variants[0].mode;
  }

  function hasExistingWorkFor(theme: ImportedTheme): boolean {
    return theme.variants.some((v) => {
      const chrome = chromeFor(v.mode);
      return assignmentsFor(v.mode).size > 0 || Boolean(chrome.background) || Boolean(chrome.foreground);
    });
  }

  function applyImport(theme: ImportedTheme) {
    importTheme(theme);
    onImported?.(`Imported "${theme.name}" (${describeVariants(theme)}) — tweak the colors and export when ready.`);
  }

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    setIsImporting(true);
    try {
      const theme = await importThemeFile(file);
      if (hasExistingWorkFor(theme)) setPendingImport(theme);
      else applyImport(theme);
    } catch (err) {
      setImportError(err instanceof ImportError ? err.message : 'Could not import this file.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="preset-picker">
      <span className="preset-picker-label">Quick start</span>
      <div className="preset-list">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="preset-card"
            style={{ background: preset.background, color: preset.text, borderColor: preset.comments }}
            onClick={() => applyPreset(preset)}
            title={`Apply the ${preset.name} preset`}
          >
            <span className="preset-name">{preset.name}</span>
            <span className="preset-dots">
              <span className="preset-dot" style={{ background: preset.keywords }} />
              <span className="preset-dot" style={{ background: preset.strings }} />
              <span className="preset-dot" style={{ background: preset.functions }} />
              {preset.numbers && <span className="preset-dot" style={{ background: preset.numbers }} />}
            </span>
          </button>
        ))}
      </div>

      <div className="preset-import">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.vsix,application/json"
          className="visually-hidden"
          onChange={handleFileChosen}
          aria-label="Import a VS Code theme file"
        />
        <button
          type="button"
          className="import-theme-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          title="Import a VS Code theme (.json or .vsix) to tweak and export as your own"
        >
          <UploadIcon size={13} /> {isImporting ? 'Importing…' : 'Import theme'}
        </button>
        {importError && <span className="preset-import-error">{importError}</span>}
      </div>

      {pendingImport && (
        <ConfirmDialog
          title={`Import "${pendingImport.name}"?`}
          body={
            <>
              This replaces your current color assignments and background/text overrides for{' '}
              <b>{describeVariants(pendingImport)}</b> mode. This can't be undone.
            </>
          }
          confirmLabel="Import & replace"
          danger
          onConfirm={() => {
            applyImport(pendingImport);
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}
