import monaco from './monacoInstance';
import { INITIAL } from 'vscode-textmate';
import type { StateStack, IToken } from 'vscode-textmate';
import { getRegistry } from './registry';
import { LANGUAGE_BY_ID, type LanguageDef } from '../data/languages';

class TokenizerState implements monaco.languages.IState {
  ruleStack: StateStack;

  constructor(ruleStack: StateStack) {
    this.ruleStack = ruleStack;
  }

  clone(): monaco.languages.IState {
    return new TokenizerState(this.ruleStack);
  }
  equals(other: monaco.languages.IState): boolean {
    return other instanceof TokenizerState && other.ruleStack === this.ruleStack;
  }
}

const wiredLanguages = new Set<string>();
const wiringInFlight = new Map<string, Promise<void>>();

/**
 * Registers a Monaco tokens provider for `languageId` backed by the real
 * TextMate grammar, instead of Monaco's default Monarch tokenizer. Monaco's
 * renderer only accepts a single token type per span, so we hand it the
 * deepest (most specific) TextMate scope and let theme rules do the usual
 * dot-segment prefix matching TextMate itself uses.
 */
export function wireLanguage(languageId: string): Promise<void> {
  if (wiredLanguages.has(languageId)) return Promise.resolve();
  // Two callers racing on the same not-yet-wired language (e.g. switching
  // A -> B -> A before A's grammar fetch resolves) must share one in-flight
  // registration — otherwise both proceed past the `wiredLanguages` check
  // and each calls `setTokensProvider`, leaking the first registration.
  let promise = wiringInFlight.get(languageId);
  if (!promise) {
    promise = wireLanguageUncached(languageId).finally(() => wiringInFlight.delete(languageId));
    wiringInFlight.set(languageId, promise);
  }
  return promise;
}

async function wireLanguageUncached(languageId: string): Promise<void> {
  const def = LANGUAGE_BY_ID.get(languageId);
  if (!def) throw new Error(`Unknown language: ${languageId}`);

  const registry = getRegistry();
  const grammar = await registry.loadGrammar(def.scopeName);
  if (!grammar) throw new Error(`Could not load grammar for scope ${def.scopeName}`);

  wiredLanguages.add(languageId);
  // The lean Monaco core (see CodeEditor.tsx) doesn't pre-register any
  // languages the way the full `monaco-editor` bundle does, so we register
  // our own ids explicitly before Monaco will recognize them at all.
  monaco.languages.register({ id: languageId });
  monaco.languages.setTokensProvider(languageId, {
    getInitialState: () => new TokenizerState(INITIAL),
    tokenize: (line, state) => {
      const ts = state as TokenizerState;
      const result = grammar.tokenizeLine(line, ts.ruleStack);
      return {
        endState: new TokenizerState(result.ruleStack),
        tokens: result.tokens.map((t) => ({
          startIndex: t.startIndex,
          scopes: t.scopes[t.scopes.length - 1] ?? def.scopeName,
        })),
      };
    },
  });
}

/**
 * Full TextMate scope stack (general -> specific) for the token under a
 * given position, computed with an independent tokenization pass since
 * Monaco's own token stream only carries the single deepest scope needed
 * for coloring (see wireLanguage above).
 */
export async function getTokenAt(
  model: monaco.editor.ITextModel,
  def: LanguageDef,
  position: monaco.Position,
): Promise<{ text: string; scopes: string[]; startColumn: number; endColumn: number } | null> {
  const registry = getRegistry();
  const grammar = await registry.loadGrammar(def.scopeName);
  if (!grammar) return null;

  let ruleStack: StateStack = INITIAL;
  let lineTokens: IToken[] = [];
  for (let line = 1; line <= position.lineNumber; line++) {
    const result = grammar.tokenizeLine(model.getLineContent(line), ruleStack);
    ruleStack = result.ruleStack;
    if (line === position.lineNumber) lineTokens = result.tokens;
  }

  const col = position.column - 1;
  const token = lineTokens.find((t) => col >= t.startIndex && col < t.endIndex);
  if (!token) return null;

  const lineText = model.getLineContent(position.lineNumber);
  return {
    text: lineText.slice(token.startIndex, token.endIndex),
    scopes: token.scopes,
    startColumn: token.startIndex + 1,
    endColumn: token.endIndex + 1,
  };
}
