import { useState, type ReactNode } from 'react';
import { useAssignments } from '../store/useAssignments';
import { buildShareLink } from '../share/shareLink';
import { CheckCircleIcon, CopyIcon, LinkedInIcon, XIcon, RedditIcon, HackerNewsIcon } from './icons';

const SHARE_TITLE = 'VS Code Theme Studio';
const SHARE_TEXT =
  'Build a custom VS Code color theme visually and export a real, installable .vsix — free, open-source, runs entirely in your browser.';

// Computed at runtime (not hardcoded) so it's correct on GitHub Pages'
// project-site subpath, a custom domain, or localhost during dev — same
// origin+base the deploy workflow already builds with (see
// deploy-pages.yml's --base flag).
function siteUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

// Each of these is a platform's public "share this URL" endpoint — no app
// registration, no OAuth, no server. It just opens a pre-filled compose
// screen in a new tab; the user still chooses to post.
const SHARE_TARGETS: Array<{ label: string; icon: ReactNode; hrefFor: (url: string) => string }> = [
  {
    label: 'LinkedIn',
    icon: <LinkedInIcon size={15} />,
    hrefFor: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: 'X',
    icon: <XIcon size={15} />,
    hrefFor: (url) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(SHARE_TEXT)}`,
  },
  {
    label: 'Reddit',
    icon: <RedditIcon size={15} />,
    hrefFor: (url) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(SHARE_TITLE)}`,
  },
  {
    label: 'Hacker News',
    icon: <HackerNewsIcon size={15} />,
    hrefFor: (url) => `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(SHARE_TITLE)}`,
  },
];

interface SharePanelProps {
  /** Reports a human-readable confirmation once the link is copied, so the caller can surface it (e.g. as a toast) — mirrors PresetPicker's onImported/onApplied. */
  onCopied?: (message: string) => void;
}

export function SharePanel({ onCopied }: SharePanelProps) {
  const { mode, themeName, productThemeName, assignmentsFor, chromeFor, pairedIconTheme } = useAssignments();
  const url = siteUrl();
  const [justCopied, setJustCopied] = useState(false);
  // Only shown if the clipboard write itself fails (permission denied,
  // unsupported browser) — the link is still right there to select by hand,
  // never silently lost.
  const [copyFallbackUrl, setCopyFallbackUrl] = useState<string | null>(null);

  // Serializes exactly what's on screen right now — every scope color and
  // chrome override for both modes, the theme name, and the paired icon
  // theme — so opening the link elsewhere renders an identical theme. See
  // src/share/shareLink.ts for the compact, versioned encoding.
  function currentThemeShareLink(): string {
    return buildShareLink({
      mode,
      themeName,
      productThemeName,
      assignments: {
        dark: [...assignmentsFor('dark').entries()],
        light: [...assignmentsFor('light').entries()],
      },
      chrome: { dark: chromeFor('dark'), light: chromeFor('light') },
      pairedIconTheme,
    });
  }

  async function handleCopyLink() {
    const link = currentThemeShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopyFallbackUrl(null);
      setJustCopied(true);
      onCopied?.('Link copied — anyone who opens it sees this exact theme.');
      setTimeout(() => setJustCopied(false), 2400);
    } catch {
      setCopyFallbackUrl(link);
    }
  }

  return (
    <>
      <div className="share-link-row">
        <button type="button" className="share-link-btn" onClick={handleCopyLink}>
          {justCopied ? <CheckCircleIcon size={14} /> : <CopyIcon size={13} />}
          {justCopied ? 'Copied!' : 'Copy link to this theme'}
        </button>
      </div>
      {copyFallbackUrl && (
        <input
          type="text"
          readOnly
          className="share-link-fallback"
          value={copyFallbackUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link to this theme — select and copy manually"
        />
      )}

      <div className="share-actions">
        {SHARE_TARGETS.map((target) => (
          <a
            key={target.label}
            className="share-btn"
            href={target.hrefFor(url)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${target.label}`}
            title={`Share on ${target.label}`}
          >
            {target.icon}
          </a>
        ))}
      </div>
      <div className="export-hint">
        "Copy link" shares this exact theme. The icons above just open a pre-filled post about the app — nothing is
        sent from here.
      </div>
    </>
  );
}
