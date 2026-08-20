import { CompassIcon, CloseIcon } from './icons';

interface TourInviteProps {
  onStart: () => void;
  onDismiss: () => void;
}

/**
 * The first-visit nudge — deliberately not the tour itself. A full-screen
 * modal on first load blocks a tool that's largely self-explanatory (click
 * a token, pick a color) before the user has done anything to be confused
 * by. This is a small, non-blocking card instead: it doesn't dim the page,
 * trap focus, or stop you from just clicking around immediately. Ignoring
 * it is a valid choice, not something that needs an explicit dismissal —
 * closing it just means "don't ask again", the same as declining the tour
 * itself.
 */
export function TourInvite({ onStart, onDismiss }: TourInviteProps) {
  return (
    <div className="tour-invite" role="status">
      <CompassIcon size={16} className="tour-invite-icon" />
      <div className="tour-invite-body">
        <div className="tour-invite-title">New here?</div>
        <p className="tour-invite-text">A 30-second tour of how this works — click real code, assign colors, export a theme.</p>
        <div className="tour-invite-actions">
          <button type="button" className="tour-invite-start-btn" onClick={onStart}>
            Take the tour
          </button>
          <button type="button" className="tour-invite-dismiss-btn" onClick={onDismiss}>
            No thanks
          </button>
        </div>
      </div>
      <button type="button" className="tour-invite-close-btn" onClick={onDismiss} aria-label="Dismiss">
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
