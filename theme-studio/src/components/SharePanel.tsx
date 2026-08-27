import { useState, type ReactNode } from 'react';
import { useAssignments } from '../store/useAssignments';
import { buildShareLink } from '../share/shareLink';
import { CheckCircleIcon, CopyIcon, LinkedInIcon, XIcon, RedditIcon, HackerNewsIcon } from './icons';

const APP_TITLE = 'VS Code Theme Studio';

interface ShareContext {
  url: string;
  title: string;
  text: string;
}

// Each of these is a platform's public "share this URL" endpoint — no app
// registration, no OAuth, no server. It just opens a pre-filled compose
// screen in a new tab; the user still chooses to post.
//
// All four open to a login/signup wall for a logged-out browser — that's
// the platform gating anonymous sharing, not something this app's link
// construction controls. Once logged in, the pre-filled url/title/text
// below are what actually populate the compose box.
//
// LinkedIn's share-offsite endpoint only ever takes a URL — whatever
// preview card it renders is scraped from *that URL's own* Open Graph tags
// at share time, not from anything passed here. This app's OG tags are
// static (no server to render per-theme metadata for a given `?t=` link),
// so LinkedIn's card stays generic even once the link itself is
// theme-specific. X/Reddit/Hacker News all accept an explicit title/text
// in the URL itself, so those three genuinely reflect the theme being shared.
const SHARE_TARGETS: Array<{ label: string; icon: ReactNode; hrefFor: (ctx: ShareContext) => string }> = [
  {
    label: 'LinkedIn',
    icon: <LinkedInIcon size={15} />,
    hrefFor: ({ url }) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: 'X',
    icon: <XIcon size={15} />,
    hrefFor: ({ url, text }) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: 'Reddit',
    icon: <RedditIcon size={15} />,
    hrefFor: ({ url, title }) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    label: 'Hacker News',
    icon: <HackerNewsIcon size={15} />,
    hrefFor: ({ url, title }) => `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(url)}&t=${encodeURIComponent(title)}`,
  },
];

interface SharePanelProps {
  /** Reports a human-readable confirmation once the link is copied, so the caller can surface it (e.g. as a toast) — mirrors PresetPicker's onImported/onApplied. */
  onCopied?: (message: string) => void;
}

export function SharePanel({ onCopied }: SharePanelProps) {
  const { mode, themeName, productThemeName, assignmentsFor, chromeFor, pairedIconTheme } = useAssignments();
  const [justCopied, setJustCopied] = useState(false);
  // Only shown if the clipboard write itself fails (permission denied,
  // unsupported browser) — the link is still right there to select by hand,
  // never silently lost.
  const [copyFallbackUrl, setCopyFallbackUrl] = useState<string | null>(null);

  // Serializes exactly what's on screen right now — every scope color and
  // chrome override for both modes, the theme name, and the paired icon
  // theme — so opening the link elsewhere renders an identical theme. See
  // src/share/shareLink.ts for the compact, versioned encoding. Both share
  // mechanisms below build on this one function — "post to social" is
  // nothing more than this same link handed to a platform's compose URL.
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

  const trimmedName = themeName.trim() || APP_TITLE;
  const shareContext: ShareContext = {
    url: currentThemeShareLink(),
    title: `${trimmedName} — a VS Code theme`,
    text: `I built "${trimmedName}" — a custom VS Code color theme — with ${APP_TITLE}. Check it out:`,
  };

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
      <div className="share-group">
        <div className="share-group-label">Share a link</div>
        <button type="button" className="share-link-btn" onClick={handleCopyLink}>
          {justCopied ? <CheckCircleIcon size={14} /> : <CopyIcon size={13} />}
          {justCopied ? 'Copied!' : 'Copy link to this theme'}
        </button>
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
        <span className="field-hint">Send it to anyone — opening it loads this exact theme, colors and all.</span>
      </div>

      <div className="share-group">
        <div className="share-group-label">Post to social</div>
        <div className="share-actions">
          {SHARE_TARGETS.map((target) => (
            <a
              key={target.label}
              className="share-btn"
              href={target.hrefFor(shareContext)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${target.label}`}
              title={`Share on ${target.label}`}
            >
              {target.icon}
            </a>
          ))}
        </div>
        <span className="field-hint">Uses the same link, pre-filled on each site — you'll need to be logged in there to post.</span>
      </div>
    </>
  );
}
