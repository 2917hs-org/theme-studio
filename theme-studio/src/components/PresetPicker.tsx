import { lazy, Suspense, useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from '../theme/presets';
import { ROLE_SCOPES } from '../theme/presetPalette';
import { useAssignments } from '../store/useAssignments';
import { track } from '../analytics/track';
import { ConfirmDialog } from './ConfirmDialog';
import type { ImportTab } from './ImportThemeDialog';
import { GridIcon, ImageIcon, SearchIcon, UploadIcon } from './icons';
import type { LanguageDef } from '../data/languages';

// Clusters adjacent same-category presets so the picker can render one
// inline label per cluster instead of one per card — adjacency (not a full
// group-by) is what lets a preset's position in THEME_PRESETS still control
// display order within its cluster.
function clusterByCategory(presets: ThemePreset[]): Array<{ category: string; presets: ThemePreset[] }> {
  const clusters: Array<{ category: string; presets: ThemePreset[] }> = [];
  for (const preset of presets) {
    const last = clusters[clusters.length - 1];
    if (last?.category === preset.category) {
      last.presets.push(preset);
    } else {
      clusters.push({ category: preset.category, presets: [preset] });
    }
  }
  return clusters;
}

const PRESET_CLUSTERS = clusterByCategory(THEME_PRESETS);

// Pulls in vscode-textmate + jsonc-parser (grammar tokenizing for the
// Marketplace preview, plus theme-file parsing, plus the icon-theme tab's
// fflate unzip) — none of it is needed until someone actually opens the
// dialog, so keep it out of the initial bundle the same way CodeEditor is
// split out in App.tsx.
const ImportThemeDialog = lazy(() => import('./ImportThemeDialog').then((m) => ({ default: m.ImportThemeDialog })));

interface PresetPickerProps {
  /** Reports a human-readable success message after a theme is imported, so the caller can surface it (e.g. as a toast). */
  onImported?: (message: string) => void;
  /** Reports a human-readable success message after a Quick Start preset is applied — mirrors onImported, kept separate since applying and importing are distinct actions worth distinguishing at the call site even though both currently render the same way. */
  onApplied?: (message: string) => void;
  /** The app's current sample — passed through to the import dialog so a Marketplace theme previews against code you're already looking at. */
  language: LanguageDef;
  code: string;
}

export function PresetPicker({ onImported, onApplied, language, code }: PresetPickerProps) {
  const { chromeFor, assignmentsFor, importTheme } = useAssignments();
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
    // Every role in ROLE_SCOPES expands to its field's color on `preset` —
    // ~20 authored colors fan out into ~160 real scope assignments, the
    // same "small palette, many scopes" shape a published theme has.
    const next = new Map<string, string>();
    for (const { field, scopes } of Object.values(ROLE_SCOPES)) {
      const color = preset[field];
      for (const scope of scopes) next.set(scope, color);
    }
    // Only one theme is ever in progress at a time — applying a preset
    // replaces the whole theme-in-progress (both modes), the same as
    // importing or forking a Marketplace theme, rather than merging into
    // whatever was already there.
    importTheme({
      name: preset.name,
      variants: [{ mode: preset.mode, chrome: { background: preset.background, foreground: preset.text }, assignments: next }],
    });
    onApplied?.(`Applied "${preset.name}".`);
    track('preset_applied', { preset: preset.id });
  }

  // Applying a preset replaces the entire theme-in-progress, not just the
  // preset's own mode — so "is there anything to lose" means either mode
  // already has something, the same test the Marketplace/Gallery import
  // flows use.
  function wouldOverwrite(): boolean {
    return (['dark', 'light'] as const).some((m) => {
      const c = chromeFor(m);
      return assignmentsFor(m).size > 0 || Boolean(c.background) || Boolean(c.foreground);
    });
  }

  function handlePresetClick(preset: ThemePreset) {
    if (wouldOverwrite()) {
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
        {PRESET_CLUSTERS.map((cluster) => (
          <div className="preset-group" key={cluster.category}>
            <span className="preset-group-label">{cluster.category}</span>
            <div className="preset-group-cards">
              {cluster.presets.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-card"
                  style={{ background: preset.background, color: preset.text, borderColor: preset.comments }}
                  onClick={() => handlePresetClick(preset)}
                  title={`Apply the ${preset.name} preset${preset.author ? ` — inspired by ${preset.author}'s theme of the same name` : ''}`}
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
            </div>
          </div>
        ))}
        <div className="preset-group">
          <div className="preset-group-cards">
            <button
              id="tour-upload"
              type="button"
              className="preset-action-card"
              onClick={() => setImportTab('upload')}
              title="Import a VS Code theme file (.json or .vsix) to tweak and export as your own"
            >
              <UploadIcon size={15} />
              <span className="preset-action-card-label">Import</span>
            </button>
            <button
              id="tour-image"
              type="button"
              className="preset-action-card"
              onClick={() => setImportTab('image')}
              title="Derive a theme from a photo — drop in an image, get a full color theme out"
            >
              <ImageIcon size={15} />
              <span className="preset-action-card-label">Image</span>
            </button>
            <button
              id="tour-search"
              type="button"
              className="preset-action-card"
              onClick={() => setImportTab('search')}
              title="Search the VS Code Marketplace for a theme to tweak and export as your own — also where you pair an icon theme"
            >
              <SearchIcon size={15} />
              <span className="preset-action-card-label">Marketplace</span>
            </button>
            <button
              id="tour-gallery"
              type="button"
              className="preset-action-card"
              onClick={() => setImportTab('gallery')}
              title="Browse themes other people built here and remix one as your own"
            >
              <GridIcon size={15} />
              <span className="preset-action-card-label">Gallery</span>
            </button>
          </div>
        </div>
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
          title="Replace your current theme?"
          body={
            <>
              Applying <b>{pendingPreset.name}</b> replaces every color assignment and background you've set — for{' '}
              <b>both dark and light</b> — with this preset's colors. This can't be undone.
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
