import { useId, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  /** Small piece of context shown next to the title, visible whether the section is open or collapsed (e.g. a count pill, or the currently-selected token). */
  badge?: ReactNode;
  /** Controlled — the parent owns which section (if any) is open, so it can enforce "opening one closes the others." */
  open: boolean;
  onToggle: () => void;
  /** Rendered on the outer <section> — lets other UI (e.g. the guided tour) target this section by DOM id without coupling to its styling classes. */
  id?: string;
  children: ReactNode;
}

/**
 * A disclosure widget for the side panel. Controlled by the parent as a
 * single-open accordion — clicking one section's header closes whichever
 * other one was open, so the panel always reads as one thing to look at
 * rather than several competing for attention. See App.tsx's `openSection`
 * state for the actual exclusivity logic; this component just renders
 * whatever `open` it's given and reports clicks via `onToggle`.
 */
export function CollapsibleSection({ title, icon, badge, open, onToggle, id, children }: CollapsibleSectionProps) {
  const contentId = useId();

  return (
    <section id={id} className={open ? 'collapsible-section collapsible-section-open' : 'collapsible-section'}>
      <button
        type="button"
        className="collapsible-header"
        onClick={onToggle}
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
