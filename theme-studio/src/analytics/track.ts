// Plausible: cookieless and GDPR-friendly with no consent banner required —
// the right fit for an app with no existing consent infrastructure to build
// against. This module is the only place that talks to it, so swapping
// providers later never touches a call site.
//
// The script only loads in a production build (`import.meta.env.PROD`) and
// only when a domain is actually configured (`VITE_PLAUSIBLE_DOMAIN`) — a
// dev server, a fork with no Plausible account, or a preview build just runs
// with analytics as a permanent no-op instead of silently pointing traffic
// at someone else's site.
declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

const PLAUSIBLE_SCRIPT_SRC = 'https://plausible.io/js/script.js';
const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

let scriptRequested = false;

function ensureScriptLoaded(): void {
  if (scriptRequested || !import.meta.env.PROD || !PLAUSIBLE_DOMAIN) return;
  scriptRequested = true;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = PLAUSIBLE_DOMAIN;
  script.src = PLAUSIBLE_SCRIPT_SRC;
  document.head.appendChild(script);
}

ensureScriptLoaded();

// The full funnel this app can instrument today — one entry per event
// actually fired from a call site, so a typo'd event name is a compile
// error instead of a silent gap in the dashboard.
export type AnalyticsEvent =
  | 'app_loaded'
  | 'language_selected'
  | 'sample_regenerated'
  | 'scope_color_assigned'
  | 'preset_applied'
  | 'theme_imported'
  | 'marketplace_theme_forked'
  | 'icon_theme_paired'
  | 'mode_toggled'
  | 'export_clicked'
  | 'export_completed'
  | 'export_failed'
  | 'tour_started'
  | 'tour_completed';

/**
 * Fires an analytics event. Always safe to call: a no-op when the script
 * hasn't loaded (dev, no domain configured, an ad blocker) and never throws,
 * since a broken analytics call must never break the app around it.
 *
 * `props` is for coarse metadata only (language name, preset id, browser/OS)
 * — never color values or anything else a user typed, since a palette is
 * their own creative work, not telemetry.
 */
export function track(event: AnalyticsEvent, props?: Record<string, string>): void {
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch (err) {
    console.error('Analytics call failed:', err);
  }
}
