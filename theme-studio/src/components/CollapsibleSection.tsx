import { useId, useState, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  /** Small piece of context shown next to the title, visible whether the section is open or collapsed (e.g. a count pill, or the currently-selected token). */
  badge?: ReactNode;
  /** Uncontrolled — each section owns its own open/closed state, so opening one never affects its siblings. */
  defaultOpen?: boolean;
  /** Rendered on the outer <section> — lets other UI (e.g. the guided tour) target this section by DOM id without coupling to its styling classes. */
  id?: string;
  children: ReactNode;
}

/**
 * A disclosure widget for the side panel. Sections are independent, not an
 * exclusive accordion — opening one doesn't force the others shut, since a
 * user mid-edit often wants two open at once (e.g. Inspect + Assigned
 * colors). `defaultOpen` is what actually delivers "focus on one section at
 * a time": only Inspect starts open, so the panel reads as one thing to look
 * at instead of four competing for attention, and the user opts into more.
 */
export function CollapsibleSection({ title, icon, badge, defaultOpen = false, id, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section id={id} className={open ? 'collapsible-section collapsible-section-open' : 'collapsible-section'}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="collapsible-header-title">
          {icon}
          <span>{title}</span>
        </span>
        <span className="collapsible-header-right">
          {badge}
          <ChevronIcon size={13} className={open ? 'collapsible-chevron collapsible-chevron-open' : 'collapsible-chevron'} />
        </span>
      </button>
      <div className="collapsible-body" id={contentId} role="region" aria-label={title} inert={!open}>
        <div className="collapsible-body-inner">{children}</div>
      </div>
    </section>
  );
}
