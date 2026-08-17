# VS Code Theme Studio

[![CI](https://github.com/2917hs-org/theme-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/2917hs-org/theme-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Assign your own colors to real syntax categories across 13 languages and export a genuinely installable VS Code theme extension (`.vsix`) — no JSON editing, ever. Runs entirely in the browser: click any token in a live Monaco editor, see its real TextMate scope, pick a color, and export.

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

Deploy configs for both [Vercel](theme-studio/vercel.json) and [Netlify](theme-studio/netlify.toml) are included, set to build from `theme-studio/` with `npm run build` and publish `dist/`. CI (`.github/workflows/ci.yml`) type-checks, lints, tests, and builds on every push and pull request to `main`.

Before going live, replace the placeholder `https://your-domain-here.example` domain in [`theme-studio/index.html`](theme-studio/index.html) and [`theme-studio/public/sitemap.xml`](theme-studio/public/sitemap.xml)/[`robots.txt`](theme-studio/public/robots.txt) with the deployed site's real origin.

## License

[MIT](LICENSE)
