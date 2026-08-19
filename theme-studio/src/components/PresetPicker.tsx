import { lazy, Suspense, useState } from 'react';
import { THEME_PRESETS, PRESET_SCOPES, type ThemePreset } from '../theme/presets';
import { useAssignments } from '../store/AssignmentsContext';
import type { ImportTab } from './ImportThemeDialog';
import { SearchIcon, UploadIcon } from './icons';
import type { LanguageDef } from '../data/languages';

// Pulls in vscode-textmate + jsonc-parser (grammar tokenizing for the
// Marketplace preview, plus theme-file parsing) — neither is needed until
// someone actually opens Upload/Search, so keep it out of the initial
// bundle the same way CodeEditor is split out in App.tsx.
const ImportThemeDialog = lazy(() => import('./ImportThemeDialog').then((m) => ({ default: m.ImportThemeDialog })));

interface PresetPickerProps {
  /** Reports a human-readable success message after a theme is imported, so the caller can surface it (e.g. as a toast). */
  onImported?: (message: string) => void;
  /** The app's current sample — passed through to the import dialog so a Marketplace theme previews against code you're already looking at. */
  language: LanguageDef;
  code: string;
}

export function PresetPicker({ onImported, language, code }: PresetPickerProps) {
  const { setMode, setChrome, setColor, clearColor } = useAssignments();
  // Which dialog tab to land on — null means the dialog is closed. Two
  // separate buttons below drive this so "Search Marketplace" is its own
  // visible entry point rather than hidden behind "Import theme" first.
  const [importTab, setImportTab] = useState<ImportTab | null>(null);

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

  return (
    <div className="preset-picker">
      <span className="preset-picker-label">Quick start</span>
      {/* Presets, upload, and search are three equally-valid ways to start a
          theme — one scrollable row instead of splitting them across
          differently-styled controls keeps that equivalence visible instead
          of implying presets are primary and the rest are an afterthought. */}
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
        <button
          type="button"
          className="preset-action-card"
          onClick={() => setImportTab('upload')}
          title="Import a VS Code theme file (.json or .vsix) to tweak and export as your own"
        >
          <UploadIcon size={18} />
          <span className="preset-action-card-label">Upload file</span>
        </button>
        <button
          type="button"
          className="preset-action-card"
          onClick={() => setImportTab('search')}
          title="Search the VS Code Marketplace for a theme to tweak and export as your own"
        >
          <SearchIcon size={18} />
          <span className="preset-action-card-label">Search Marketplace</span>
        </button>
      </div>

      {importTab && (
        <Suspense
          fallback={
            <div className="confirm-overlay">
              <div className="spinner" />
            </div>
          }
        >
          <ImportThemeDialog
            initialTab={importTab}
            onClose={() => setImportTab(null)}
            onImported={(message) => onImported?.(message)}
            language={language}
            code={code}
          />
        </Suspense>
      )}
    </div>
  );
}
