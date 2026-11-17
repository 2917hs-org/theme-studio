// The Community Gallery (Tier 1, no backend): a hand-curated list of
// community-built themes, each stored as nothing more than a shareable
// theme link (see src/share/shareLink.ts) — the entire theme lives in that
// one URL, so listing it here needs no server, database, or upload step.
//
// To submit a theme: build it in the app, click "Copy link to this theme"
// in the Share panel, then open a pull request adding an entry below with
// that link, your name (or handle), and a one-line description.
//
// Empty until the first real submission lands — nothing here is
// auto-generated from the built-in presets, since a preset's original
// designer (credited in src/theme/presets.ts) didn't submit it to this
// gallery and crediting them as if they had would misrepresent where it
// came from.
export interface GalleryEntry {
  /** Display name for the theme, as the submitter titled it — independent of whatever `themeName` happens to be baked into the link itself. */
  name: string;
  /** Whoever submitted this theme, credited on its card and in the remix attribution banner. */
  author: string;
  /** A full shareable theme link — everything needed to render and remix this theme lives in its `?t=` param. */
  link: string;
  /** One line about the theme, shown on its card. */
  description?: string;
}

export const GALLERY_THEMES: GalleryEntry[] = [];
