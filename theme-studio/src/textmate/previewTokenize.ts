import { INITIAL } from 'vscode-textmate';
import type { StateStack } from 'vscode-textmate';
import { getRegistry } from './registry';
import type { LanguageDef } from '../data/languages';
import type { ChromeOverride } from '../theme/chrome';
import type { ThemeMode } from '../theme/mode';
import { defaultForegroundFor } from '../theme/baseline';

export interface PreviewToken {
  text: string;
  color: string;
}

// Same longest-dot-segment-prefix matching Monaco's own token theme service
// uses for `token: scope` rules (e.g. an assignment on "keyword" matches a
// token scoped "keyword.control.enum.ts") — reimplemented here because this
// preview renders without a live Monaco editor at all (see the comment in
// ImportThemeDialog on why: Monaco's theme is a page-global singleton, so a
// second live editor showing different colors would fight the real one).
export function colorForScope(scope: string, assignments: Map<string, string>): string | undefined {
  let candidate = scope;
  while (candidate) {
    const color = assignments.get(candidate);
    if (color) return color;
    const lastDot = candidate.lastIndexOf('.');
    if (lastDot === -1) break;
    candidate = candidate.slice(0, lastDot);
  }
  return undefined;
}

/** Tokenizes `code` against the language's real TextMate grammar and colors each token per `assignments` — a plain data transform, no Monaco/editor involved. */
export async function tokenizeForPreview(
  def: LanguageDef,
  code: string,
  assignments: Map<string, string>,
  mode: ThemeMode,
  chrome?: ChromeOverride,
): Promise<PreviewToken[][]> {
  const grammar = await getRegistry().loadGrammar(def.scopeName);
  if (!grammar) throw new Error(`Could not load grammar for scope ${def.scopeName}`);

  const fallbackColor = defaultForegroundFor(mode, chrome);
  let ruleStack: StateStack = INITIAL;

  return code.split('\n').map((lineText) => {
    const result = grammar.tokenizeLine(lineText, ruleStack);
    ruleStack = result.ruleStack;
    return result.tokens.map((t) => {
      const scope = t.scopes[t.scopes.length - 1] ?? def.scopeName;
      return {
        text: lineText.slice(t.startIndex, t.endIndex),
        color: colorForScope(scope, assignments) ?? fallbackColor,
      };
    });
  });
}
