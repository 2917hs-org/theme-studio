// Single canonical import of Monaco's lean core API (see CodeEditor.tsx for
// why we avoid the full `monaco-editor` package root). Importing the exact
// same deep subpath from more than one module has been unreliable under
// this project's Vite/Rolldown build (resolves for the first importer,
// fails for the next) — routing every consumer through this one module
// sidesteps that by only ever resolving the specifier once.
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

export default monaco;
