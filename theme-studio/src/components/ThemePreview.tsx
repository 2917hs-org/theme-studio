import { useEffect, useState } from 'react';
import type { LanguageDef } from '../data/languages';
import type { ImportedVariant } from '../theme/importTheme';
import { tokenizeForPreview, type PreviewToken } from '../textmate/previewTokenize';
import { baselineColorsFor } from '../theme/baseline';

interface ThemePreviewProps {
  language: LanguageDef;
  code: string;
  variant: ImportedVariant;
  /** Keep showing the previous result while a new one tokenizes, instead of flashing a loading state — for callers that flip between variants of the same code. */
  keepWhileLoading?: boolean;
}

/**
 * Renders `code` colored with `variant`'s actual parsed assignments — real
 * tokenization against the language's TextMate grammar, not a decorative
 * approximation. Deliberately not a second live Monaco instance: Monaco's
 * theme is a page-global singleton (`monaco.editor.setTheme` affects every
 * editor on the page), so a second editor showing different colors would
 * fight the real one instead of coexisting with it. See previewTokenize.ts.
 */
export function ThemePreview({ language, code, variant, keepWhileLoading = false }: ThemePreviewProps) {
  const [lines, setLines] = useState<PreviewToken[][] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!keepWhileLoading) setLines(null);
    setFailed(false);
    tokenizeForPreview(language, code, variant.assignments, variant.mode, variant.chrome)
      .then((result) => {
        if (!cancelled) setLines(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [language, code, variant, keepWhileLoading]);

  if (failed) {
    return <div className="theme-preview-empty">Couldn't render a preview for this theme.</div>;
  }

  if (!lines) {
    return <div className="theme-preview-empty">Rendering preview…</div>;
  }

  const background = variant.chrome.background ?? baselineColorsFor(variant.mode)['editor.background'];
  const foreground = variant.chrome.foreground ?? baselineColorsFor(variant.mode)['editor.foreground'];

  return (
    <pre className="theme-preview-code" style={{ background, color: foreground }}>
      {lines.map((tokens, i) => (
        <div className="theme-preview-line" key={i}>
          {tokens.length === 0
            ? ' '
            : tokens.map((t, j) => (
                <span key={j} style={{ color: t.color }}>
                  {t.text}
                </span>
              ))}
        </div>
      ))}
    </pre>
  );
}
