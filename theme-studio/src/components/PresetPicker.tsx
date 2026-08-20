import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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

const OVERWRITE_ARM_TIMEOUT_MS = 3000;
const PRESET_SCOPE_LIST = Object.values(PRESET_SCOPES);

interface PresetPickerProps {
  /** Reports a human-readable success message after a theme is imported, so the caller can surface it (e.g. as a toast). */
  onImported?: (message: string) => void;
  /** The app's current sample — passed through to the import dialog so a Marketplace theme previews against code you're already looking at. */
  language: LanguageDef;
  code: string;
}

export function PresetPicker({ onImported, language, code }: PresetPickerProps) {
  const { setMode, chromeFor, assignmentsFor, setChrome, setColor, clearColor } = useAssignments();
  // Which dialog tab to land on — null means the dialog is closed. Two
  // separate buttons below drive this so "Search Marketplace" is its own
  // visible entry point rather than hidden behind "Import theme" first.
  const [importTab, setImportTab] = useState<ImportTab | null>(null);
  // Which preset (by id) is armed, waiting for a confirming second click —
  // only ever set when that preset would actually overwrite something (see
  // handlePresetClick). Mirrors AssignedColorsPanel's "click again to
  // confirm" pattern instead of a full modal, since a preset only ever
  // touches a handful of scopes plus the background/foreground, not
  // everything the way Clear all/Reset do.
  const [armedPresetId, setArmedPresetId] = useState<string | null>(null);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
  }, []);

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

  // A preset only overwrites the handful of scopes it defines plus the
  // background/foreground — so unlike Clear all/Reset, "is there anything
  // to lose" has to be checked against that mode's specific state, not
  // just "is anything assigned at all".
  function wouldOverwrite(preset: ThemePreset): boolean {
    const currentChrome = chromeFor(preset.mode);
    if (currentChrome.background || currentChrome.foreground) return true;
    const currentAssignments = assignmentsFor(preset.mode);
    return PRESET_SCOPE_LIST.some((scope) => currentAssignments.has(scope));
  }

  function handlePresetClick(preset: ThemePreset) {
    if (armedPresetId !== preset.id && wouldOverwrite(preset)) {
      setArmedPresetId(preset.id);
      if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = setTimeout(() => setArmedPresetId(null), OVERWRITE_ARM_TIMEOUT_MS);
      return;
    }
    if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
    setArmedPresetId(null);
    applyPreset(preset);
  }

  return (
    <div id="tour-quick-start" className="preset-picker">
      <span className="preset-picker-label">Quick start</span>
      {/* Presets, upload, and search are three equally-valid ways to start a
          theme — one scrollable row instead of splitting them across
          differently-styled controls keeps that equivalence visible instead
          of implying presets are primary and the rest are an afterthought. */}
      <div className="preset-list">
        {THEME_PRESETS.map((preset) => {
          const armed = armedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              className={armed ? 'preset-card preset-card-confirming' : 'preset-card'}
              style={{ background: preset.background, color: preset.text, borderColor: armed ? undefined : preset.comments }}
              onClick={() => handlePresetClick(preset)}
              onBlur={() => armed && setArmedPresetId(null)}
              title={
                armed
                  ? `This replaces your current ${preset.mode} comment/keyword/string/function/number colors and background — click again to apply the ${preset.name} preset`
                  : `Apply the ${preset.name} preset`
              }
            >
              {armed ? (
                <span className="preset-name">Click again to overwrite</span>
              ) : (
                <>
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-dots">
                    <span className="preset-dot" style={{ background: preset.keywords }} />
                    <span className="preset-dot" style={{ background: preset.strings }} />
                    <span className="preset-dot" style={{ background: preset.functions }} />
                    {preset.numbers && <span className="preset-dot" style={{ background: preset.numbers }} />}
                  </span>
                </>
              )}
            </button>
          );
        })}
        <button
          id="tour-upload"
          type="button"
          className="preset-action-card"
          onClick={() => setImportTab('upload')}
          title="Import a VS Code theme file (.json or .vsix) to tweak and export as your own"
        >
          <UploadIcon size={18} />
          <span className="preset-action-card-label">Upload file</span>
        </button>
        <button
          id="tour-search"
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
