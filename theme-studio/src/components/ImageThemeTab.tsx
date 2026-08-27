import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { LanguageDef } from '../data/languages';
import type { ThemeMode } from '../theme/mode';
import type { ImportedTheme } from '../theme/importTheme';
import { extractPaletteFromImage } from '../theme/imageExtract';
import { CORE_FIELDS, CORE_FIELD_LABELS, buildImageTheme, chooseCoreFields, deriveTheme, fieldsToAssignments, suggestedNameFromFile, type CoreField } from '../theme/imageToPreset';
import { track } from '../analytics/track';
import { ThemePreview } from './ThemePreview';
import { ImageIcon } from './icons';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Decode straight to this size via createImageBitmap's own resize option —
// a 40MP photo is never fully decoded at full resolution in the first
// place. Squashing to a fixed box (rather than preserving aspect ratio)
// doesn't cost anything here: only the resulting color histogram matters
// for extraction, not the image's proportions.
const DECODE_SIZE = 100;

type TabState =
  | { kind: 'idle' }
  | { kind: 'extracting' }
  | { kind: 'ready'; file: File; core: Record<CoreField, string> }
  | { kind: 'error'; message: string };

interface ImageThemeTabProps {
  mode: ThemeMode;
  language: LanguageDef;
  code: string;
  onApply: (theme: ImportedTheme) => void;
}

export function ImageThemeTab({ mode, language, code, onApply }: ImageThemeTabProps) {
  const [state, setState] = useState<TabState>({ kind: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setState({ kind: 'error', message: 'Unsupported file type — choose a JPEG, PNG, WebP, or GIF.' });
      track('image_theme_failed');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setState({ kind: 'error', message: 'That image is too large — choose one under 10 MB.' });
      track('image_theme_failed');
      return;
    }

    track('image_theme_uploaded');
    setState({ kind: 'extracting' });
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
        resizeWidth: DECODE_SIZE,
        resizeHeight: DECODE_SIZE,
        resizeQuality: 'medium',
      });
      const palette = extractPaletteFromImage(bitmap, 10);
      if (palette.colors.length < 3) {
        throw new Error("Couldn't find enough color variety in this image.");
      }
      const core = chooseCoreFields(palette, mode);
      track('image_theme_extracted');
      setState({ kind: 'ready', file, core });
    } catch (err) {
      track('image_theme_failed');
      setState({
        kind: 'error',
        message: err instanceof Error && err.message ? err.message : "Couldn't read this image — it may be corrupt.",
      });
    }
  }

  function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-choosing the same file later
    if (file) void processFile(file);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function updateCore(field: CoreField, hex: string) {
    setState((prev) => (prev.kind === 'ready' ? { ...prev, core: { ...prev.core, [field]: hex } } : prev));
  }

  function reset() {
    setState({ kind: 'idle' });
  }

  const ready = state.kind === 'ready' ? state : null;

  // Recomputed from `core` on every edit so the preview and the eventual
  // applied theme are always built from the exact same derivation — no
  // separate "preview colors" vs "final colors" to drift apart.
  const derived = useMemo(() => (ready ? deriveTheme(ready.core) : null), [ready]);
  const previewVariant = useMemo(
    () =>
      derived
        ? { mode, chrome: { background: derived.background, foreground: derived.text }, assignments: fieldsToAssignments(derived.fields) }
        : null,
    [derived, mode],
  );

  function handleApply() {
    if (!ready) return;
    const theme = buildImageTheme(suggestedNameFromFile(ready.file), ready.core, mode);
    onApply(theme);
  }

  return (
    <div className="import-search-pane">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="visually-hidden"
        onChange={handleFileChosen}
        aria-label="Choose a photo to derive a theme from"
      />

      {!ready && (
        <button
          type="button"
          className={isDragging ? 'import-upload-dropzone import-upload-dropzone-active' : 'import-upload-dropzone'}
          onClick={() => fileInputRef.current?.click()}
          disabled={state.kind === 'extracting'}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {state.kind === 'extracting' ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <span className="import-upload-dropzone-title">Extracting colors…</span>
            </>
          ) : (
            <>
              <ImageIcon size={22} />
              <span className="import-upload-dropzone-title">Drop a photo, or choose a file</span>
              <span className="import-upload-dropzone-hint">JPEG, PNG, WebP, or GIF — under 10 MB</span>
              <span className="image-theme-idea-row" aria-hidden="true">
                <span className="image-theme-idea">a desk setup</span>
                <span className="image-theme-idea">a poster</span>
                <span className="image-theme-idea">a logo</span>
              </span>
            </>
          )}
        </button>
      )}

      {state.kind === 'error' && (
        <div className="import-dialog-error">
          {state.message}{' '}
          <button type="button" className="image-theme-retry-btn" onClick={reset}>
            Try another image
          </button>
        </div>
      )}

      {ready && derived && previewVariant && (
        <div className="marketplace-search-layout">
          <div className="image-theme-controls">
            <div className="image-theme-chips">
              {CORE_FIELDS.map((field) => (
                <div className="image-theme-chip" key={field}>
                  <input
                    type="color"
                    id={`image-theme-field-${field}`}
                    className="color-native-input"
                    value={ready.core[field]}
                    onChange={(e) => updateCore(field, e.target.value)}
                    aria-label={`${CORE_FIELD_LABELS[field]} color, extracted from the image — click to adjust`}
                  />
                  <label htmlFor={`image-theme-field-${field}`} className="image-theme-chip-label">
                    {CORE_FIELD_LABELS[field]}
                  </label>
                </div>
              ))}
            </div>
            <button type="button" className="export-btn image-theme-apply-btn" onClick={handleApply}>
              Use this theme
            </button>
            <button type="button" className="image-theme-retry-btn image-theme-retry-btn-secondary" onClick={reset}>
              Try another image
            </button>
          </div>

          <div className="marketplace-preview-pane">
            <div className="marketplace-preview-title">{suggestedNameFromFile(ready.file)}</div>
            <ThemePreview language={language} code={code} variant={previewVariant} />
          </div>
        </div>
      )}
    </div>
  );
}
