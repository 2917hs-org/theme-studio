import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Exported so other modal-like overlays (e.g. SiteTour) that need the same Tab-trap can reuse the exact selector instead of drifting out of sync with it.
export const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// A native `confirm()` can't be styled to match the rest of the app and
// blocks the whole tab (including Monaco's own key handling) while open.
// This is a plain, focus-manageable stand-in for the one place we need a
// real "are you sure" — cancel is the default action (first, autofocused)
// so an accidental Enter never triggers the destructive path.
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Captured at first render — before autoFocus below moves focus onto the
  // cancel button — so it points at whatever triggered the dialog (e.g. the
  // "Reset" button) and can get focus back once the dialog closes.
  const previouslyFocusedRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  useEffect(() => {
    const previouslyFocused = previouslyFocusedRef.current;
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      // Trapping Tab keeps keyboard focus inside what's otherwise only a
      // visually/semantically modal dialog (role="alertdialog", aria-modal)
      // — without this, Tab/Shift+Tab walks straight into the app behind it.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
  }, [onCancel]);

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title" className="confirm-title">
          {title}
        </h2>
        <div className="confirm-body">{body}</div>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button className={danger ? 'confirm-confirm-btn confirm-confirm-btn-danger' : 'confirm-confirm-btn'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
