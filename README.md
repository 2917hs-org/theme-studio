# VS Code Theme Studio

[![CI](https://github.com/2917hs-org/theme-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/2917hs-org/theme-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Assign your own colors to real syntax categories across 17 languages and export to VS Code (`.vsix`), Windows Terminal, iTerm2, or Zed — no JSON editing, ever. Runs entirely in the browser: click any token in a live Monaco editor, see its real TextMate scope, pick a color, and export. Start from a built-in preset, an uploaded theme file, a Marketplace search, or a community-submitted theme in the Gallery — then share your finished theme with anyone via a single link, no account needed.

The app lives in [`theme-studio/`](theme-studio) — see [`theme-studio/README.md`](theme-studio/README.md) for setup, scripts, and architecture notes.

## Quick start

```bash
cd theme-studio
npm install
npm run dev
```

## Scripts (run from `theme-studio/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Deployment

The live site is deployed to GitHub Pages by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) on every push to `release`, at https://2917hs-org.github.io/theme-studio/. Deploy configs for [Vercel](theme-studio/vercel.json) and [Netlify](theme-studio/netlify.toml) are also included as alternative hosts. GitHub Pages can't send custom HTTP response headers at all, so the long-lived asset caching and security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`) in those two files only take effect if the site is actually hosted on Vercel or Netlify — as a baseline that works on any host including GitHub Pages, [`index.html`](theme-studio/index.html) also ships a `Content-Security-Policy` and `Referrer-Policy` via `<meta>` tags; the header-based CSP on Vercel/Netlify additionally covers `frame-ancestors` (clickjacking protection), which `<meta>` delivery can't express. CI (`.github/workflows/ci.yml`) type-checks, lints, tests, and builds on every push and pull request to `main` and `release`; the deploy workflow runs the same checks before publishing. Both workflows share those checks through one composite action, [`.github/actions/verify`](.github/actions/verify), so they can't silently drift apart.

## Releases

Cutting a release is manual: tag a commit on `main` (once its CI run is green) and push the tag. `.github/workflows/release.yml` picks it up and creates a GitHub Release with notes auto-generated from the commits/PRs since the previous tag.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Use [semantic versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`) — the workflow only triggers on tags matching that shape.

## License

[MIT](LICENSE)
