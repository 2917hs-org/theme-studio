import { useEffect, useRef, useState } from 'react';
// See textmate/monacoInstance.ts for why this goes through a shared module
// instead of importing 'monaco-editor' directly (lean bundle + a build quirk
// with resolving the same deep import path from multiple files).
import monaco from '../textmate/monacoInstance';
import type { LanguageDef } from '../data/languages';
import { wireLanguage, getTokenAt } from '../textmate/monacoBridge';
import { resolveScope, type ScopeResolution } from '../data/scopeLabels';
import { useAssignments } from '../store/useAssignments';
import { buildMonacoTheme } from '../theme/themeBuilder';
import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';

// Monaco doesn't reliably refresh editor-chrome colors when a *base*
// ('vs-dark' vs 'vs') is redefined under the same theme id — it only
// recomputes reliably when the theme id itself changes. Folding mode,
// isolate, and the chrome override into the id makes every visually
// distinct combination a genuine theme swap instead of a same-id edit.
function liveThemeName(mode: ThemeMode, isolate: boolean, chrome?: ChromeOverride): string {
  // Monaco theme ids must be alphanumeric/hyphen only — strip the "#" and
  // join with hyphens instead of the underscores that tripped its validator.
  const bg = (chrome?.background ?? 'default').replace('#', '');
  const fg = (chrome?.foreground ?? 'default').replace('#', '');
  return `theme-studio-live-${mode}-${isolate ? 'isolate' : 'full'}-${bg}-${fg}`;
}

export interface TokenSelection {
  text: string;
  resolution: ScopeResolution;
}

interface CodeEditorProps {
  language: LanguageDef;
  code: string;
  /** When true, only assigned scopes show color — everything else flattens to one neutral gray. */
  isolate: boolean;
  onTokenSelect: (selection: TokenSelection | null) => void;
}

export function CodeEditor({ language, code, isolate, onTokenSelect }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const languageRef = useRef<LanguageDef>(language);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const { assignments, mode, chrome } = useAssignments();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Create the editor once, bootstrapped with whatever mode is active at
  // mount (so it opens in the right theme immediately instead of always
  // starting dark and correcting a moment later).
  useEffect(() => {
    if (!containerRef.current) return;
    monaco.editor.defineTheme(liveThemeName(mode, isolate, chrome), buildMonacoTheme(mode, assignments, { isolate, chrome }));
    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 14,
      automaticLayout: true,
      theme: liveThemeName(mode, isolate, chrome),
      renderLineHighlight: 'none',
      scrollBeyondLastLine: false,
      padding: { top: 16 },
    });
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection([]);

    async function inspectPosition(position: monaco.Position) {
      const model = editor.getModel();
      if (!model) return;
      const currentDef = languageRef.current;
      let token: Awaited<ReturnType<typeof getTokenAt>>;
      try {
        token = await getTokenAt(model, currentDef, position);
      } catch (err) {
        console.error('Failed to resolve token scope:', err);
        return;
      }
      if (!token) {
        decorationsRef.current?.set([]);
        onTokenSelect(null);
        return;
      }
      decorationsRef.current?.set([
        {
          range: new monaco.Range(position.lineNumber, token.startColumn, position.lineNumber, token.endColumn),
          options: {
            className: 'token-highlight',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]);
      onTokenSelect({ text: token.text, resolution: resolveScope(token.scopes, currentDef.scopeName) });
    }

    editor.onMouseDown((e) => {
      if (e.target.position) inspectPosition(e.target.position);
    });

    // Touch devices don't reliably fire onMouseDown the same way — Monaco's
    // own touch handling treats a tap as "select this word" first. Catching
    // that as a non-empty selection covers tap-to-inspect on mobile without
    // hijacking plain keyboard cursor movement (handled separately below) or
    // the programmatic resets from model.setValue() below.
    editor.onDidChangeCursorSelection((e) => {
      if (!e.selection.isEmpty()) {
        inspectPosition(e.selection.getStartPosition());
      }
    });

    // Keyboard-only users move the cursor with arrow keys, which leaves the
    // selection empty — the listener above alone makes token inspection
    // mouse/touch-only. `reason === Explicit` covers real keyboard/mouse
    // cursor moves while excluding the ContentFlush reason model.setValue()
    // below fires on every language/sample change.
    editor.onDidChangeCursorPosition((e) => {
      if (e.reason === monaco.editor.CursorChangeReason.Explicit) {
        inspectPosition(e.position);
      }
    });

    return () => editor.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire grammar + set content whenever language or code changes.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    (async () => {
      try {
        await wireLanguage(language.id);
      } catch (err) {
        if (cancelled) return;
        console.error(`Failed to load ${language.label} grammar:`, err);
        setLoadError(
          err instanceof Error
            ? err.message
            : `Could not load the ${language.label} grammar.`,
        );
        setIsLoading(false);
        return;
      }
      if (cancelled) return;
      const editor = editorRef.current;
      if (!editor) return;
      languageRef.current = language;
      decorationsRef.current?.set([]);
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language.id);
        model.setValue(code);
      }
      onTokenSelect(null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, code, retryToken]);

  // Re-apply theme whenever color assignments, mode, isolate mode, or the chrome override change.
  useEffect(() => {
    monaco.editor.defineTheme(liveThemeName(mode, isolate, chrome), buildMonacoTheme(mode, assignments, { isolate, chrome }));
    monaco.editor.setTheme(liveThemeName(mode, isolate, chrome));
  }, [mode, assignments, isolate, chrome]);

  return (
    <div className="editor-container">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isLoading && !loadError && (
        <div className="editor-loading-overlay">
          <div className="spinner" />
          <span>Loading {language.label} grammar…</span>
        </div>
      )}
      {loadError && (
        <div className="editor-loading-overlay editor-error-overlay">
          <span>Couldn't load the {language.label} grammar: {loadError}</span>
          <button className="editor-retry-btn" onClick={() => setRetryToken((t) => t + 1)}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
