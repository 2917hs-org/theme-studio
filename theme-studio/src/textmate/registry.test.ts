import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vscode-textmate's real Registry caches a loadGrammar() promise per scope
// forever — including a rejected one — and never calls our loader again for
// that scope. This fake reproduces exactly that behavior (verified against
// the real package) without needing a real oniguruma/WASM tokenizer, so the
// test below is exercising our own recovery logic in registry.ts, not
// vscode-textmate internals.
class FakeRegistry {
  private cache = new Map<string, Promise<unknown>>();
  private loadGrammarImpl: (scopeName: string) => Promise<unknown>;
  constructor(options: { loadGrammar: (scopeName: string) => Promise<unknown> }) {
    this.loadGrammarImpl = options.loadGrammar;
  }
  loadGrammar(scopeName: string): Promise<unknown> {
    let promise = this.cache.get(scopeName);
    if (!promise) {
      promise = this.loadGrammarImpl(scopeName);
      this.cache.set(scopeName, promise);
    }
    return promise;
  }
}

vi.mock('vscode-textmate', () => ({
  Registry: FakeRegistry,
  parseRawGrammar: (content: string) => JSON.parse(content),
}));

vi.mock('vscode-oniguruma', () => ({
  loadWASM: vi.fn().mockResolvedValue(undefined),
  createOnigScanner: vi.fn(),
  createOnigString: vi.fn(),
}));

const ORIGINAL_FETCH = globalThis.fetch;

describe('getRegistry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('recovers on the next loadGrammar() call after a grammar fetch fails, instead of staying permanently broken', async () => {
    const { getRegistry } = await import('./registry');

    const scope = 'source.rust';
    let attempt = 0;
    // First call fails (simulates a transient network blip); every call
    // after that succeeds — the real bug this test guards is a Retry (or
    // switching languages away and back) never re-attempting the fetch at
    // all once vscode-textmate has cached the failure.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('onig.wasm')) return new Response(new ArrayBuffer(8), { status: 200 });
      if (url.includes('rust.tmLanguage.json')) {
        attempt++;
        if (attempt === 1) throw new TypeError('Simulated network failure');
        return new Response(JSON.stringify({ scopeName: 'source.rust', patterns: [] }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    await expect(getRegistry().loadGrammar(scope)).rejects.toThrow();
    const grammar = await getRegistry().loadGrammar(scope);

    expect(attempt).toBe(2);
    expect(grammar).toBeTruthy();
  });
});
