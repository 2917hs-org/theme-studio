import type { LanguageDef } from '../../data/languages';

/** The preview is only convincing if it's long enough to read like a real file. Samples are normally well over this; a short one (JSON, occasionally) is topped up with more of the same language. */
export const MIN_PREVIEW_LINES = 20;

export function padToMinLines(language: LanguageDef, code: string, minLines = MIN_PREVIEW_LINES): string {
  let padded = code;
  for (let seed = 1; padded.split('\n').length < minLines && seed <= 5; seed++) {
    padded += `\n${language.generate(seed)}`;
  }
  return padded;
}
