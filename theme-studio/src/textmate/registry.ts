import { loadWASM, createOnigScanner, createOnigString } from 'vscode-oniguruma';
import { Registry, parseRawGrammar } from 'vscode-textmate';
import type { IRawGrammar } from 'vscode-textmate';
import { LANGUAGES, AUX_GRAMMARS } from '../data/languages';

async function fetchOk(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    // fetch() itself only throws for network-level failures (offline, DNS,
    // CORS) — distinguish that from a reachable-but-erroring server below,
    // since "check your connection" vs "try again" are different asks.
    const reason = navigator.onLine === false ? 'you appear to be offline' : 'a network error occurred';
    throw new Error(`Couldn't reach ${path} — ${reason}.`);
  }
  if (!res.ok) throw new Error(`Fetching ${path} failed: ${res.status} ${res.statusText}`);
  return res;
}

let onigLibPromise: Promise<{ createOnigScanner: typeof createOnigScanner; createOnigString: typeof createOnigString }> | null = null;

function getOnigLib() {
  if (!onigLibPromise) {
    onigLibPromise = fetchOk(`${import.meta.env.BASE_URL}wasm/onig.wasm`)
      .then((r) => r.arrayBuffer())
      .then((buf) => loadWASM(buf))
      .then(() => ({ createOnigScanner, createOnigString }))
      .catch((err) => {
        // Don't leave a permanently-rejected promise cached — a transient
        // network failure shouldn't permanently break every future attempt.
        // The Registry singleton below captured this promise at construction
        // and can't be handed a replacement, so it's poisoned too; drop it.
        onigLibPromise = null;
        registrySingleton = null;
        throw err;
      });
  }
  return onigLibPromise;
}

const grammarFileByScope: Record<string, string> = {
  ...Object.fromEntries(LANGUAGES.map((l) => [l.scopeName, l.grammarFile])),
  ...AUX_GRAMMARS,
};

const rawGrammarCache = new Map<string, Promise<IRawGrammar | undefined>>();

async function loadRawGrammar(scopeName: string): Promise<IRawGrammar | undefined> {
  const path = grammarFileByScope[scopeName];
  if (!path) return undefined;
  let promise = rawGrammarCache.get(scopeName);
  if (!promise) {
    promise = fetchOk(path)
      .then((r) => r.text())
      .then((content) => parseRawGrammar(content, path))
      .catch((err) => {
        rawGrammarCache.delete(scopeName);
        // vscode-textmate's Registry caches a failed loadGrammar() call
        // permanently per scope — it never calls this loader again for the
        // same scope, even after the underlying problem (a network blip)
        // is gone. Dropping the whole Registry singleton on any grammar
        // failure, the same way getOnigLib already does for a WASM load
        // failure, is what makes the editor's "Retry" button (and simply
        // switching languages away and back) actually work again instead
        // of permanently wedging that language for the rest of the session.
        registrySingleton = null;
        throw err;
      });
    rawGrammarCache.set(scopeName, promise);
  }
  return promise;
}

let registrySingleton: Registry | null = null;

export function getRegistry(): Registry {
  if (!registrySingleton) {
    registrySingleton = new Registry({
      onigLib: getOnigLib(),
      loadGrammar: loadRawGrammar,
    });
  }
  return registrySingleton;
}
