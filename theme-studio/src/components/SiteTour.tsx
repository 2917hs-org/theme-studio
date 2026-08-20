import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dismissTour } from '../store/tourStorage';
import { FOCUSABLE_SELECTOR } from './ConfirmDialog';
import { CloseIcon } from './icons';

interface TourStep {
  /** DOM id of the element to spotlight, or null for a centered, target-less step (welcome/closing). */
  targetId: string | null;
  title: string;
  body: string;
}

// Points at the same ids CollapsibleSection/PresetPicker/ModeSwitcher/App
// already render for their own layout — nothing tour-specific lives on
// those elements beyond the id itself, so the tour breaks loudly (a step
// with no spotlight) rather than silently if one is ever renamed.
const STEPS: TourStep[] = [
  {
    targetId: null,
    title: 'Welcome to VS Code Theme Studio',
    body: "A 30-second tour of how this works: click real code, assign real colors, export a real theme. Skip anytime — nothing here is required.",
  },
  {
    targetId: 'tour-quick-start',
    title: 'Start with a preset',
    body: 'Seven built-in presets apply a full color scheme in one click — a fast way to see the app in action or start a theme you fine-tune from here.',
  },
  {
    targetId: 'tour-upload',
    title: 'Or bring your own theme',
    body: "Upload a .json or .vsix theme file and it loads straight into the editor, ready to tweak and re-export as your own.",
  },
  {
    targetId: 'tour-search',
    title: 'Or fork one from the Marketplace',
    body: 'Search real, published VS Code themes and start editing a copy immediately — no download, no account.',
  },
  {
    targetId: 'tour-regenerate',
    title: "Not loving this sample?",
    body: 'Regenerate swaps in a fresh, randomized code sample in the same language. Every color you\'ve already assigned stays exactly where it is.',
  },
  {
    targetId: 'tour-editor',
    title: 'Click any token',
    body: "This is real code, tokenized with the same TextMate grammars VS Code itself uses. Click a token to see its real syntax scope.",
  },
  {
    targetId: 'tour-inspect',
    title: 'Assign it a color',
    body: 'Once a token is selected, color it here — hex, the picker, or a quick palette. It applies to the editor instantly.',
  },
  {
    targetId: 'tour-mode-switcher',
    title: 'Dark and Light, independently',
    body: "Every color you assign is tracked per mode. Pick a background color here and the mode switches to match it automatically.",
  },
  {
    targetId: 'tour-export',
    title: 'Export a real theme',
    body: "When you're happy, download an installable .vsix bundling both modes, or copy a one-line command to install it straight into VS Code.",
  },
  {
    targetId: 'tour-reset',
    title: 'Nothing here is permanent',
    body: "Reset clears everything back to defaults — colors, chrome, language, name — in one click. Export first if there's anything you want to keep.",
  },
];

const SPOTLIGHT_PADDING = 8;
const POPOVER_WIDTH = 320;
const POPOVER_EST_HEIGHT = 190;
const VIEWPORT_MARGIN = 14;

interface SiteTourProps {
  /** Called once the tour is skipped or completed — the caller stops rendering SiteTour. Whether it also sticks for future visits depends only on the "don't show again" checkbox, handled internally. */
  onDone: () => void;
}

export function SiteTour({ onDone }: SiteTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  // Tracks down the step's target every time the step changes, scrolls it
  // into view (it may be inside a collapsed-but-visible section or below
  // the fold), then keeps the spotlight glued to it through scroll/resize —
  // the app's own layout reflows at a few breakpoints this needs to survive.
  useLayoutEffect(() => {
    if (!step.targetId) {
      setRect(null);
      return;
    }
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    // The smooth scroll above is async — one more measurement once it's
    // likely settled avoids the spotlight briefly sitting on the pre-scroll
    // position.
    const settleTimer = setTimeout(measure, 260);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [step.targetId]);

  useEffect(() => {
    nextBtnRef.current?.focus();
  }, [stepIndex]);

  function finish() {
    if (dontShowAgain) dismissTour();
    onDone();
  }

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        finish();
        return;
      }
      if (e.key !== 'Tab' || !popoverRef.current) return;
      const focusable = Array.from(popoverRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dontShowAgain, stepIndex]);

  const popoverStyle = rect ? placePopover(rect) : undefined;

  return (
    <div className="tour-overlay">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      ) : (
        <div className="tour-backdrop" />
      )}

      {/* Sits above the spotlight (which is pointer-events: none) and below
          the popover — clicking anywhere outside the popover skips the tour,
          the same "click outside closes" convention ConfirmDialog uses. */}
      <div className="tour-click-catcher" onClick={finish} />

      <div
        ref={popoverRef}
        className={rect ? 'tour-popover' : 'tour-popover tour-popover-centered'}
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        <div className="tour-popover-head">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i === stepIndex ? 'tour-dot tour-dot-active' : 'tour-dot'} />
            ))}
          </div>
          <button type="button" className="tour-close-btn" onClick={finish} aria-label="Skip tour">
            <CloseIcon size={12} />
          </button>
        </div>

        <h2 id="tour-step-title" className="tour-title">
          {step.title}
        </h2>
        <p className="tour-body">{step.body}</p>

        <label className="tour-checkbox-row">
          <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
          Don&apos;t show this tour again
        </label>

        <div className="tour-actions">
          <button type="button" className="tour-back-btn" onClick={goBack} disabled={isFirst}>
            Back
          </button>
          <button type="button" className="tour-next-btn" onClick={goNext} ref={nextBtnRef}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function placePopover(rect: DOMRect): { position: 'fixed'; top: number; left: number; width: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.bottom + SPOTLIGHT_PADDING + 8;
  if (top + POPOVER_EST_HEIGHT > vh - VIEWPORT_MARGIN) {
    // Not enough room below — try above instead.
    top = rect.top - SPOTLIGHT_PADDING - 8 - POPOVER_EST_HEIGHT;
  }
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - POPOVER_EST_HEIGHT - VIEWPORT_MARGIN));

  let left = rect.left;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - POPOVER_WIDTH - VIEWPORT_MARGIN));

  return { position: 'fixed', top, left, width: POPOVER_WIDTH };
}
