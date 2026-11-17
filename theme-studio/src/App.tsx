import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, type LanguageDef } from './data/languages';
import type { TokenSelection } from './components/CodeEditor';
import { LanguagePicker } from './components/LanguagePicker';
import { PresetPicker } from './components/PresetPicker';
import { ModeSwitcher } from './components/ModeSwitcher';
import { InspectorPanel } from './components/InspectorPanel';
import { AssignedColorsPanel, groupByColor } from './components/AssignedColorsPanel';
import { ExportPanel } from './components/ExportPanel';
import { CollapsibleSection } from './components/CollapsibleSection';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SharePanel } from './components/SharePanel';
import { SiteTour } from './components/SiteTour';
import { TourInvite } from './components/TourInvite';
import { Toast } from './components/Toast';
import { useToast } from './components/useToast';
import { SpotlightIcon, RefreshIcon, RotateCcwIcon, CursorClickIcon, SwatchIcon, ExportIcon, Share2Icon, CompassIcon } from './components/icons';
import { AssignmentsProvider } from './store/AssignmentsContext';
import { useAssignments } from './store/useAssignments';
import { DEFAULT_THEME_NAME } from './store/defaultThemeName';
import { dismissTour, hasTourBeenDismissed } from './store/tourStorage';
import { downloadInFlight } from './vsix/buildVsix';
import { track } from './analytics/track';
import { clearShareLinkParam, decodeShareLink, readShareLinkParam, shareLinkToImportedTheme, type ShareLinkPayload } from './share/shareLink';

// Monaco is the single largest dependency in this app (its core editor
// engine alone is a few MB). Code-splitting it into its own chunk means the
// app shell (header, language picker) paints immediately instead of
// blocking on that download.
const CodeEditor = lazy(() => import('./components/CodeEditor').then((m) => ({ default: m.CodeEditor })));

type SectionId = 'inspect' | 'assigned' | 'export' | 'share';

function AppInner() {
  const [language, setLanguage] = useState<LanguageDef>(LANGUAGES[0]);
  const [seed, setSeed] = useState(1);
  const [selection, setSelection] = useState<TokenSelection | null>(null);
  const [isolateColors, setIsolateColors] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showTourInvite, setShowTourInvite] = useState(false);
  const {
    assignmentsFor,
    chromeFor,
    mode,
    setMode,
    themeName,
    setThemeName,
    setThemeNameAutoTracked,
    setProductThemeName,
    pairedIconTheme,
    setPairedIconTheme,
    importTheme,
    resetAll,
    wasRestored,
  } = useAssignments();
  // The four side-panel sections form a single-open accordion — opening one
  // closes whichever else was open, so the panel reads as one thing to look
  // at instead of several competing for attention. Starts on whichever of
  // Inspect/Assigned actually has something to show given a restored
  // session, matching the previous per-section `defaultOpen` heuristics.
  const [openSection, setOpenSection] = useState<SectionId | null>(() =>
    assignmentsFor('dark').size + assignmentsFor('light').size > 0 ? 'assigned' : 'inspect',
  );
  function toggleSection(id: SectionId) {
    setOpenSection((current) => (current === id ? null : id));
  }
  const { toastMessage, showToast } = useToast();
  // A theme being applied/imported/used gets a shorter, snappier
  // notification than the app's other toasts (session-restore, Reset) —
  // it's confirming something the user just watched happen on screen, not
  // surfacing news they need a normal beat to notice and read.
  const THEME_TOAST_DURATION_MS = 2000;
  const showThemeToast = (message: string) => showToast(message, THEME_TOAST_DURATION_MS);

  // Applying/importing/remixing a theme (Quick Start, Marketplace, Upload,
  // Gallery) is exactly the moment "Assigned colors" becomes the
  // interesting section to be looking at — whichever section the accordion
  // happened to be on before isn't what the user just did.
  function handleThemeApplied(message: string) {
    showThemeToast(message);
    setOpenSection('assigned');
  }

  useEffect(() => {
    track('app_loaded');
  }, []);

  // Replaces the whole theme-in-progress with what a shared `?t=` link
  // encodes (see src/share/shareLink.ts) — reuses `importTheme` for the
  // assignments/chrome swap, then explicitly overrides the mode, theme name,
  // and paired icon theme importTheme deliberately doesn't touch, so the
  // hydrated state matches the sender's exactly rather than just their colors.
  function hydrateFromShareLink(payload: ShareLinkPayload) {
    importTheme(shareLinkToImportedTheme(payload));
    setMode(payload.mode);
    setThemeName(payload.themeName);
    setThemeNameAutoTracked(false);
    setProductThemeName(payload.productThemeName);
    setPairedIconTheme(payload.pairedIconTheme);
  }

  // Runs once at mount, before the user can do anything that would count as
  // "unsaved local work" — a link is only ever the *initial* URL you land
  // on, never something to re-check after interacting with the app.
  useEffect(() => {
    const encoded = readShareLinkParam();
    if (!encoded) return;
    // Stripped immediately either way — a malformed, stale, or already-applied
    // link shouldn't keep re-triggering on refresh or Back navigation.
    clearShareLinkParam();
    const result = decodeShareLink(encoded);
    if (!result.ok) {
      showToast(
        result.reason === 'old-version'
          ? 'This link was made with an older version of Theme Studio.'
          : "This link looks broken — couldn't load it.",
      );
      return;
    }
    // Opening a shared link is already an unambiguous "load this" action —
    // gating it behind a confirm-dialog button asked the user to approve
    // something they'd already decided by clicking the link. Applies
    // immediately either way; the toast is the only feedback, same as any
    // other theme-applying action in this app (a preset, an import).
    hydrateFromShareLink(result.payload);
    handleThemeApplied('Loaded the shared theme.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First-visit-only, by default — hasTourBeenDismissed reads localStorage,
  // so this only runs once per mount rather than on every render, and
  // respects the invite's own "no thanks" (same dismissal flag the full
  // tour's checkbox uses). Offers the tour rather than opening it outright
  // — a blocking modal on first load interrupts a tool that's largely
  // self-explanatory before the user has done anything to be confused by.
  useEffect(() => {
    if (!hasTourBeenDismissed()) setShowTourInvite(true);
  }, []);

  function startTour() {
    setShowTourInvite(false);
    setShowTour(true);
    track('tour_started');
  }

  function dismissTourInvite() {
    setShowTourInvite(false);
    dismissTour();
  }

  // The whole app's chrome follows the same dark/light mode as the theme
  // being built, rather than a second independent app-preference toggle.
  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', mode);
  }, [mode]);

  // Color work autosaves to this browser (see AssignmentsContext), but only
  // here — a different browser, device, or cleared site data still loses it
  // with no way back, so the warning below stays as a safety net regardless.
  useEffect(() => {
    if (wasRestored) showToast('Restored your previous session from this browser.');
  }, [wasRestored, showToast]);

  const totalAssignments = assignmentsFor('dark').size + assignmentsFor('light').size;
  // Distinct colors across both modes — what the Assigned colors panel
  // actually renders one row per, not the raw scope count above (a single
  // color routinely fans out across dozens of scopes).
  const totalDistinctColors = groupByColor(assignmentsFor('dark')).length + groupByColor(assignmentsFor('light')).length;

  useEffect(() => {
    if (totalAssignments === 0) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // Safari, unlike Chrome/Firefox, doesn't cleanly exempt an `<a
      // download>` click from its normal navigation/unload pipeline while a
      // `beforeunload` listener is attached — see downloadInFlight's doc
      // comment in buildVsix.ts for the full story.
      if (downloadInFlight.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalAssignments]);

  const code = useMemo(() => language.generate(seed), [language, seed]);

  // Clicking a real token is the user asking to inspect it — switch the
  // accordion there so the panel they actually want is what's showing,
  // whichever one happened to be open before. A selection being *cleared*
  // (regenerate, language switch) is never itself something to react to.
  function handleTokenSelect(next: TokenSelection | null) {
    setSelection(next);
    if (next) setOpenSection('inspect');
  }

  function handleRegenerate() {
    setSeed((s) => s + 1);
    setSelection(null);
    track('sample_regenerated');
  }

  function handleSelectLanguage(lang: LanguageDef) {
    if (lang.id === language.id) return;
    track('language_selected', { language: lang.id });
    // Color assignments key on universal TextMate scope names (keyword,
    // string, ...), not anything TypeScript- or Python-specific — the same
    // "keyword" purple applies correctly in any grammar. So switching
    // languages is exactly as safe as regenerating a new sample: keep every
    // assignment, just drop whatever token happened to be selected in the
    // old sample.
    setLanguage(lang);
    setSelection(null);
  }

  function hasCustomizations(): boolean {
    const chromeDirty = (m: 'dark' | 'light') => Boolean(chromeFor(m).background || chromeFor(m).foreground);
    return (
      totalAssignments > 0 ||
      chromeDirty('dark') ||
      chromeDirty('light') ||
      language.id !== LANGUAGES[0].id ||
      themeName !== DEFAULT_THEME_NAME ||
      pairedIconTheme !== null
    );
  }

  function performReset() {
    setLanguage(LANGUAGES[0]);
    setSeed(1);
    setSelection(null);
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
          <button className="reset-app-btn" onClick={startTour} title="Replay the guided tour">
            <CompassIcon size={12} /> Tour
          </button>
          <button id="tour-reset" className="reset-app-btn" onClick={handleResetClick} title="Reset everything back to defaults — no page reload">
            <RotateCcwIcon size={12} /> Reset
          </button>
        </div>
        {toastMessage && <Toast message={toastMessage} />}
      </header>

      <div className="top-controls">
        <PresetPicker onImported={handleThemeApplied} onApplied={handleThemeApplied} language={language} code={code} />

        <LanguagePicker selected={language} onSelect={handleSelectLanguage} />
      </div>

      <main className="app-main">
        <div className="editor-column">
          <div id="tour-editor" className="editor-pane">
            <div className="editor-toolbar">
              <button
                id="code-regenerate"
                className="editor-toolbar-btn"
                onClick={handleRegenerate}
                title="Generate a new code sample — your color assignments are kept"
                aria-label="Regenerate sample"
              >
                <RefreshIcon size={14} />
              </button>
              <button
                className={isolateColors ? 'editor-toolbar-btn editor-toolbar-btn-active' : 'editor-toolbar-btn'}
                onClick={() => setIsolateColors((v) => !v)}
                title={isolateColors ? 'Showing only your assigned colors — click to preview full defaults' : 'Show only your assigned colors'}
                aria-label="Toggle isolating assigned colors"
                aria-pressed={isolateColors}
              >
                <SpotlightIcon size={14} />
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
              <CodeEditor language={language} code={code} isolate={isolateColors} onTokenSelect={handleTokenSelect} />
            </Suspense>
          </div>
        </div>
        <aside className="side-pane">
          <ModeSwitcher />

          <CollapsibleSection
            id="tour-inspect"
            title="Inspect token"
            icon={<CursorClickIcon size={14} />}
            open={openSection === 'inspect'}
            onToggle={() => toggleSection('inspect')}
            badge={
              selection && (
                <span className="collapsible-badge" title={selection.text}>
                  {selection.text}
                </span>
              )
            }
          >
            <InspectorPanel selection={selection} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Assigned colors"
            icon={<SwatchIcon size={14} />}
            open={openSection === 'assigned'}
            onToggle={() => toggleSection('assigned')}
            badge={totalDistinctColors > 0 && <span className="collapsible-count">{totalDistinctColors}</span>}
          >
            <AssignedColorsPanel />
          </CollapsibleSection>

          <div className="pinned-footer">
            <CollapsibleSection
              id="tour-export"
              title="Export theme"
              icon={<ExportIcon size={14} />}
              open={openSection === 'export'}
              onToggle={() => toggleSection('export')}
            >
              <ExportPanel />
            </CollapsibleSection>

            <CollapsibleSection
              id="tour-share"
              title="Share"
              icon={<Share2Icon size={14} />}
              open={openSection === 'share'}
              onToggle={() => toggleSection('share')}
            >
              <SharePanel onCopied={showThemeToast} />
            </CollapsibleSection>
          </div>
        </aside>
      </main>

      {showTourInvite && <TourInvite onStart={startTour} onDismiss={dismissTourInvite} />}

      {showTour && (
        <SiteTour
          onDone={() => {
            track('tour_completed');
            setShowTour(false);
          }}
        />
      )}

      {resetPending && (
        <ConfirmDialog
          title="Reset everything?"
          body={
            <>
              This clears every color assignment, custom background/text color, theme name, and paired icon theme, and puts
              the language and layout back to their defaults. This can't be undone.
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
