# VS Code Theme Studio

Assign your own colors to real syntax categories across 13 languages and export a genuinely installable VS Code theme extension (`.vsix`) — no JSON editing, ever.

Click any token in the live Monaco editor to see its real TextMate scope (the same scopes VS Code itself uses for highlighting), assign it a color with the picker, and export a ready-to-install `.vsix` for both dark and light variants.

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Lint with [oxlint](https://oxc.rs) |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## How it works

- **Tokenization**: real TextMate grammars (`public/grammars/*.tmLanguage.json`) are compiled with `vscode-textmate` + `vscode-oniguruma` (WASM) and wired into Monaco as a custom tokens provider (`src/textmate/`), so the editor highlights exactly the way VS Code does — not Monaco's built-in Monarch tokenizers.
- **Color assignment**: clicking a token resolves its full scope chain and hands the deepest scope to the inspector (`src/components/InspectorPanel.tsx`); colors are kept per scope, per theme mode (dark/light) in `src/store/AssignmentsContext.tsx`.
- **Live preview**: the assigned colors are compiled into a Monaco theme on every change (`src/theme/themeBuilder.ts`) so the editor always reflects exactly what will be exported.
- **Export**: `src/vsix/buildVsix.ts` packages a real VS Code extension — `package.json`, `extension.vsixmanifest`, theme JSON per mode, and an icon — into a `.vsix` zip with [`fflate`](https://github.com/101arrowz/fflate), entirely client-side.

Nothing is persisted (by design — see `App.tsx`'s `beforeunload` guard); everything lives in memory for the session.

## Expanding the Oxlint configuration

For type-aware lint rules, install `oxlint-tsgolint` and edit `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## License

[MIT](../LICENSE)
