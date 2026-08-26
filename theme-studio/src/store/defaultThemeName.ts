// Empty by default — the Theme name field now auto-fills a "vsts-..."
// pattern from whatever's actually selected (see ExportPanel.tsx), rather
// than starting pre-filled with a placeholder-looking name.
//
// Lives in its own file (not AssignmentsContext.tsx) so that file can stay
// component-only — a file mixing a component export with a plain constant
// export breaks Fast Refresh for the component (react/only-export-components).
export const DEFAULT_THEME_NAME = '';
