import type { ReactNode } from 'react';
import { Share2Icon, LinkedInIcon, XIcon, RedditIcon, HackerNewsIcon } from './icons';

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

export function SharePanel() {
  const url = siteUrl();

  return (
    <div className="panel-section">
      <div className="panel-section-header">
        <Share2Icon size={15} />
        <span>Share this tool</span>
      </div>
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
      <div className="export-hint">Opens a pre-filled post on each site — nothing is sent from here.</div>
    </div>
  );
}
