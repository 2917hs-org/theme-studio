import * as samples from './samples';
import type { SampleGenerator } from './samples';

// ---------------------------------------------------------------------
// To add a new language:
//   1. Find its TextMate grammar (a .tmLanguage.json — VS Code's own
//      built-in language extensions are a reliable MIT-licensed source:
//      github.com/microsoft/vscode/tree/main/extensions/<lang>/syntaxes).
//   2. Drop it in public/grammars/ and note its root `scopeName`.
//   3. Add a LanguageDef entry below. `id` becomes the Monaco language id
//      (see textmate/monacoBridge.ts — we register it ourselves since we
//      don't use Monaco's bundled languages) and must be unique.
//   4. Write 1–2 sample generators in samples.ts (see the pattern there)
//      and reference them via `generate`.
//   5. If the grammar embeds another one (e.g. HTML-in-PHP, JS-in-HTML),
//      add the embedded scope to AUX_GRAMMARS below so cross-grammar
//      `include` references resolve instead of falling back to plain text.
// No other file needs to change — CodeEditor, the language picker, and
// the export pipeline all just iterate LANGUAGES.
// ---------------------------------------------------------------------

export interface LanguageDef {
  id: string;
  label: string;
  scopeName: string;
  grammarFile: string;
  generate: SampleGenerator;
  /** Accent color for the language's picker badge — purely a scanning aid. */
  accent: string;
}

export const LANGUAGES: LanguageDef[] = [
  { id: 'typescript', label: 'TypeScript', scopeName: 'source.ts', grammarFile: '/grammars/typescript.tmLanguage.json', generate: samples.typescript, accent: '#3178c6' },
  { id: 'javascript', label: 'JavaScript', scopeName: 'source.js', grammarFile: '/grammars/javascript.tmLanguage.json', generate: samples.javascript, accent: '#e8c547' },
  { id: 'python', label: 'Python', scopeName: 'source.python', grammarFile: '/grammars/python.tmLanguage.json', generate: samples.python, accent: '#4b8bbe' },
  { id: 'java', label: 'Java', scopeName: 'source.java', grammarFile: '/grammars/java.tmLanguage.json', generate: samples.java, accent: '#e76f51' },
  { id: 'csharp', label: 'C#', scopeName: 'source.cs', grammarFile: '/grammars/csharp.tmLanguage.json', generate: samples.csharp, accent: '#9b5de5' },
  { id: 'cpp', label: 'C++', scopeName: 'source.cpp', grammarFile: '/grammars/cpp.tmLanguage.json', generate: samples.cpp, accent: '#5c9ce6' },
  { id: 'go', label: 'Go', scopeName: 'source.go', grammarFile: '/grammars/go.tmLanguage.json', generate: samples.go, accent: '#4dd0c4' },
  { id: 'rust', label: 'Rust', scopeName: 'source.rust', grammarFile: '/grammars/rust.tmLanguage.json', generate: samples.rust, accent: '#dd7b5f' },
  { id: 'php', label: 'PHP', scopeName: 'source.php', grammarFile: '/grammars/php.tmLanguage.json', generate: samples.php, accent: '#8b8bd8' },
  { id: 'html', label: 'HTML', scopeName: 'text.html.basic', grammarFile: '/grammars/html.tmLanguage.json', generate: samples.html, accent: '#e6714b' },
  { id: 'css', label: 'CSS', scopeName: 'source.css', grammarFile: '/grammars/css.tmLanguage.json', generate: samples.css, accent: '#4f9ee6' },
  { id: 'json', label: 'JSON', scopeName: 'source.json', grammarFile: '/grammars/json.tmLanguage.json', generate: samples.json, accent: '#9aa5b1' },
  { id: 'sql', label: 'SQL', scopeName: 'source.sql', grammarFile: '/grammars/sql.tmLanguage.json', generate: samples.sql, accent: '#4dbd8c' },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

// Supplementary grammars that top-level languages embed/include (e.g. PHP
// embeds HTML, HTML embeds JS/CSS). Registered so vscode-textmate can
// resolve cross-grammar `include` references instead of falling back to
// plain, unstyled text for those embedded regions.
export const AUX_GRAMMARS: Record<string, string> = {
  'source.js': '/grammars/javascript.tmLanguage.json',
  'source.css': '/grammars/css.tmLanguage.json',
  'text.html.basic': '/grammars/html.tmLanguage.json',
  'source.cpp.embedded.macro': '/grammars/cpp.embedded.macro.tmLanguage.json',
};
