// monaco-editor's package.json `exports` map doesn't declare a `types`
// condition for its deep subpaths, so TypeScript's bundler resolution can't
// find `editor.api.js`'s adjacent .d.ts on its own even though the file
// exists. The full `monaco-editor` package re-exports those exact same
// declarations (its root index just does `export ... from
// './editor/editor.api.js'`), so borrowing them here is type-accurate —
// this is a types-only shim with no runtime/bundle cost; the actual code
// still imports the lean JS module.
declare module 'monaco-editor/esm/vs/editor/editor.api.js' {
  export * from 'monaco-editor';
}
