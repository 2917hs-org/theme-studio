import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, type LanguageDef } from './data/languages';
import type { TokenSelection } from './components/CodeEditor';
import { LanguagePicker } from './components/LanguagePicker';
import { PresetPicker } from './components/PresetPicker';
import { InspectorPanel } from './components/InspectorPanel';
import { ExportPanel } from './components/ExportPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast, useToast } from './components/Toast';
import { MaximizeIcon, MinimizeIcon, SpotlightIcon, RotateCcwIcon } from './components/icons';
import { AssignmentsProvider, useAssignments, DEFAULT_THEME_NAME } from './store/AssignmentsContext';

// Monaco is the single largest dependency in this app (its core editor
// engine alone is a few MB). Code-splitting it into its own chunk means the
// app shell (header, language picker) paints immediately instead of
// blocking on that download.
const CodeEditor = lazy(() => import('./components/CodeEditor').then((m) => ({ default: m.CodeEditor })));

function AppInner() {
  const [language, setLanguage] = useState<LanguageDef>(LANGUAGES[0]);
  const [seed, setSeed] = useState(1);
  const [selection, setSelection] = useState<TokenSelection | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isolateColors, setIsolateColors] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<LanguageDef | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const { assignmentsFor, chromeFor, mode, themeName, clearAllColors, resetAll } = useAssignments();
  const { toastMessage, showToast } = useToast();

  // The whole app's chrome follows the same dark/light mode as the theme
  // being built, rather than a second independent app-preference toggle.
  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', mode);
  }, [mode]);

  // Nothing here persists anywhere — closing or reloading the tab would
  // silently discard all color work with no way back. Warn before that.
  const totalAssignments = assignmentsFor('dark').size + assignmentsFor('light').size;

  useEffect(() => {
    if (totalAssignments === 0) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalAssignments]);

  const code = useMemo(() => language.generate(seed), [language, seed]);

  function handleRegenerate() {
    setSeed((s) => s + 1);
    setSelection(null);
  }

  function handleSelectLanguage(lang: LanguageDef) {
    if (lang.id === language.id) return;
    if (totalAssignments === 0) {
      setLanguage(lang);
      return;
    }
    // Switching languages resets all color work, so hold off until the
    // user confirms — cancelling must leave the current language and every
    // assignment untouched.
    setPendingLanguage(lang);
  }

  function confirmLanguageSwitch() {
    if (!pendingLanguage) return;
    clearAllColors();
    setLanguage(pendingLanguage);
    showToast(`Switched to ${pendingLanguage.label} — color assignments were reset.`);
    setPendingLanguage(null);
  }

  function cancelLanguageSwitch() {
    setPendingLanguage(null);
  }

  function hasCustomizations(): boolean {
    const chromeDirty = (m: 'dark' | 'light') => Boolean(chromeFor(m).background || chromeFor(m).foreground);
    return (
      totalAssignments > 0 ||
      chromeDirty('dark') ||
      chromeDirty('light') ||
      language.id !== LANGUAGES[0].id ||
      themeName !== DEFAULT_THEME_NAME
    );
  }

  function performReset() {
    setLanguage(LANGUAGES[0]);
    setSeed(1);
    setSelection(null);
    setIsMaximized(false);
    setIsolateColors(false);
    resetAll();
  }

  function handleResetClick() {
    // Nothing meaningful would be lost — no need to interrupt with a dialog.
    if (!hasCustomizations()) {
      performReset();
      return;
    }
    setResetPending(true);
  }

  function confirmReset() {
    performReset();
    showToast('Reset to defaults.');
    setResetPending(false);
  }

  function cancelReset() {
    setResetPending(false);
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <svg className="app-logo" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="url(#logo-grad)" />
            <path d="M9 8l-3 4 3 4M15 8l3 4-3 4" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="logo-grad" x1="2.5" y1="2.5" x2="21.5" y2="21.5" gradientUnits="userSpaceOnUse">
                <stop stopColor="#569cd6" />
                <stop offset="1" stopColor="#c586c0" />
              </linearGradient>
            </defs>
          </svg>
          <div>
            <h1 className="app-title">VS Code Theme Studio</h1>
            <p className="app-subtitle">Color real syntax, export a real theme.</p>
          </div>
        </div>
        <div className="app-topbar-controls">
          {totalAssignments > 0 && (
            <div className="app-progress-badge">
              {totalAssignments} scope{totalAssignments === 1 ? '' : 's'} colored
            </div>
          )}
          <button className="reset-app-btn" onClick={handleResetClick} title="Reset everything back to defaults — no page reload">
            <RotateCcwIcon size={12} /> Reset
          </button>
        </div>
      </header>

      <PresetPicker />

      <LanguagePicker selected={language} onSelect={handleSelectLanguage} onRegenerate={handleRegenerate} />

      <main className="app-main">
        <div className="editor-pane">
          <div className="editor-toolbar">
            <button
              className={isolateColors ? 'editor-toolbar-btn editor-toolbar-btn-active' : 'editor-toolbar-btn'}
              onClick={() => setIsolateColors((v) => !v)}
              title={isolateColors ? 'Showing only your assigned colors — click to preview full defaults' : 'Show only your assigned colors'}
              aria-label="Toggle isolating assigned colors"
              aria-pressed={isolateColors}
            >
              <SpotlightIcon size={14} />
            </button>
            <button
              className="editor-toolbar-btn"
              onClick={() => setIsMaximized((m) => !m)}
              title={isMaximized ? 'Restore layout' : 'Maximize editor'}
              aria-label={isMaximized ? 'Restore layout' : 'Maximize editor'}
            >
              {isMaximized ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
            </button>
          </div>
          {isolateColors && (
            <div className="isolate-banner">
              <SpotlightIcon size={12} /> Showing only your assigned colors — everything else is flattened to gray
            </div>
          )}
          <Suspense
            fallback={
              <div className="editor-loading-overlay" style={{ position: 'static', height: '100%' }}>
                <div className="spinner" />
                <span>Loading editor…</span>
              </div>
            }
          >
            <CodeEditor language={language} code={code} isolate={isolateColors} onTokenSelect={setSelection} />
          </Suspense>
        </div>
        {!isMaximized && (
          <aside className="side-pane">
            <InspectorPanel selection={selection} />
            <ExportPanel />
          </aside>
        )}
      </main>

      {toastMessage && <Toast message={toastMessage} />}

      {pendingLanguage && (
        <ConfirmDialog
          title={`Switch to ${pendingLanguage.label}?`}
          body={
            <>
              This clears every color you've assigned — {totalAssignments} assignment
              {totalAssignments === 1 ? '' : 's'} across dark and light — and starts a fresh
              sample in {pendingLanguage.label}. This can't be undone.
            </>
          }
          confirmLabel="Switch & clear colors"
          danger
          onConfirm={confirmLanguageSwitch}
          onCancel={cancelLanguageSwitch}
        />
      )}

      {resetPending && (
        <ConfirmDialog
          title="Reset everything?"
          body={
            <>
              This clears every color assignment, custom background/text color, and theme name, and puts the language and
              layout back to their defaults. This can't be undone.
            </>
          }
          confirmLabel="Reset"
          danger
          onConfirm={confirmReset}
          onCancel={cancelReset}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AssignmentsProvider>
      <AppInner />
    </AssignmentsProvider>
  );
}
