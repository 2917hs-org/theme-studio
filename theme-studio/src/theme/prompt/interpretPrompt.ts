import type { ThemeBrief } from './brief';
import { ruleBasedInterpreter } from './ruleInterpreter';

/** Longest prompt any interpreter is asked to read — a cap, not a validation error: longer input is truncated. */
export const MAX_PROMPT_LENGTH = 400;

export type InterpretResult =
  | {
      ok: true;
      brief: ThemeBrief;
      /** Short labels for what the interpreter picked up (e.g. "eye comfort", "forest") — shown back to the user. */
      matched: string[];
      /** Which interpreter produced this, so callers can tell a rules result from a future model-backed one. */
      interpreter: string;
    }
  | { ok: false; reason: 'empty' | 'unrecognized' };

/**
 * Anything that can turn free text into a ThemeBrief. The rule-based one
 * below is "layer 1"; a bring-your-own-key model call or a server proxy
 * would implement this same interface, so the dialog and generator never
 * change when the interpreter does. `interpret` is async for exactly that
 * reason, even though the rules run synchronously.
 */
export interface PromptInterpreter {
  id: string;
  interpret(prompt: string, signal?: AbortSignal): Promise<InterpretResult>;
}

export interface InterpretOptions {
  interpreter?: PromptInterpreter;
  signal?: AbortSignal;
}

/** Turns a user's description ("dark theme, easy on the eyes") into a ThemeBrief. Never throws for bad input — failure is a typed result. */
export async function interpretPrompt(prompt: string, options: InterpretOptions = {}): Promise<InterpretResult> {
  const text = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  if (!text) return { ok: false, reason: 'empty' };
  const interpreter = options.interpreter ?? ruleBasedInterpreter;
  return interpreter.interpret(text, options.signal);
}
