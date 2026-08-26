import { lazy, Suspense, useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from '../theme/presets';
import { ROLE_SCOPES } from '../theme/presetPalette';
import { useAssignments } from '../store/AssignmentsContext';
import { ConfirmDialog } from './ConfirmDialog';
import type { ImportTab } from './ImportThemeDialog';
import { SearchIcon, UploadIcon } from './icons';
import type { LanguageDef } from '../data/languages';

// Pulls in vscode-textmate + jsonc-parser (grammar tokenizing for the
// Marketplace preview, plus theme-file parsing, plus the icon-theme tab's
// fflate unzip) — none of it is needed until someone actually opens the
// dialog, so keep it out of the initial bundle the same way CodeEditor is
// split out in App.tsx.
const ImportThemeDialog = lazy(() => import('./ImportThemeDialog').then((m) => ({ default: m.ImportThemeDialog })));

interface PresetPickerProps {
  /** Reports a human-readable success message after a theme is imported, so the caller can surface it (e.g. as a toast). */
  onImported?: (message: string) => void;
  /** The app's current sample — passed through to the import dialog so a Marketplace theme previews against code you're already looking at. */
  language: LanguageDef;
  code: string;
}

export function PresetPicker({ onImported, language, code }: PresetPickerProps) {
  const { setMode, chromeFor, assignmentsFor, setChrome, replaceAssignments, setProductThemeName } = useAssignments();
  // Which dialog tab to land on — null means the dialog is closed. Two
  // separate buttons below drive this so "Search Marketplace" is its own
  // visible entry point rather than hidden behind "Import theme" first.
  const [importTab, setImportTab] = useState<ImportTab | null>(null);
  // The preset waiting on confirmation because it would overwrite an
  // existing theme (see wouldOverwrite) — a real modal instead of a timed
  // "click again" state. That pattern looked like the button just didn't
  // work if you clicked a beat too slowly (glanced away, the row reflowed,
  // whatever) and the window quietly expired with no feedback at all.
  const [pendingPreset, setPendingPreset] = useState<ThemePreset | null>(null);

  function applyPreset(preset: ThemePreset) {
    setMode(preset.mode);
    setProductThemeName(preset.name);
    setChrome(preset.mode, { background: preset.background, foreground: preset.text });
    // A full clean swap to exactly what this preset defines, not a merge —
    // replaceAssignments drops every scope the mode had before (including
    // ones this preset doesn't even mention, like a token colored by hand
    // in the editor), instead of leaving them mixed in with the new theme.
    // Every role in ROLE_SCOPES expands to its field's color on `preset` —
    // ~20 authored colors fan out into ~160 real scope assignments, the
    // same "small palette, many scopes" shape a published theme has.
    const next = new Map<string, string>();
    for (const { field, scopes } of Object.values(ROLE_SCOPES)) {
      const color = preset[field];
      for (const scope of scopes) next.set(scope, color);
    }
    replaceAssignments(preset.mode, next);
  }

  // Applying a preset replaces every color in that mode, not just the
  // handful it defines — so "is there anything to lose" is just "does this
  // mode already have anything at all", the same test Reset uses.
  function wouldOverwrite(preset: ThemePreset): boolean {
    const currentChrome = chromeFor(preset.mode);
    if (currentChrome.background || currentChrome.foreground) return true;
    return assignmentsFor(preset.mode).size > 0;
  }

  function handlePresetClick(preset: ThemePreset) {
    if (wouldOverwrite(preset)) {
      setPendingPreset(preset);
      return;
    }
    applyPreset(preset);
  }

  function confirmPending() {
    if (pendingPreset) applyPreset(pendingPreset);
    setPendingPreset(null);
  }

  return (
    <div id="tour-quick-start" className="preset-picker">
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
            onClick={() => handlePresetClick(preset)}
            title={`Apply the ${preset.name} preset`}
          >
            <span className="preset-name">{preset.name}</span>
            <span className="preset-dots">
              <span className="preset-dot" style={{ background: preset.keywords }} />
              <span className="preset-dot" style={{ background: preset.strings }} />
              <span className="preset-dot" style={{ background: preset.functions }} />
              <span className="preset-dot" style={{ background: preset.types }} />
              <span className="preset-dot" style={{ background: preset.numbers }} />
            </span>
          </button>
        ))}
        <button
          id="tour-upload"
          type="button"
          className="preset-action-card"
          onClick={() => setImportTab('upload')}
          title="Import a VS Code theme file (.json or .vsix) to tweak and export as your own"
        >
          <UploadIcon size={18} />
          <span className="preset-action-card-label">Import</span>
        </button>
        <button
          id="tour-search"
          type="button"
          className="preset-action-card"
          onClick={() => setImportTab('search')}
          title="Search the VS Code Marketplace for a theme to tweak and export as your own — also where you pair an icon theme"
        >
          <SearchIcon size={18} />
          <span className="preset-action-card-label">Marketplace</span>
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

      {pendingPreset && (
        <ConfirmDialog
          title={`Replace your ${pendingPreset.mode} theme?`}
          body={
            <>
              Applying <b>{pendingPreset.name}</b> replaces every color you've assigned in {pendingPreset.mode} mode,
              plus its background, with this preset's colors. This can't be undone.
            </>
          }
          confirmLabel="Apply preset"
          danger
          onConfirm={confirmPending}
          onCancel={() => setPendingPreset(null)}
        />
      )}
    </div>
  );
}
