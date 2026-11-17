import { useEffect, useMemo, useRef, useState } from 'react';
import { useAssignments } from '../store/useAssignments';
import { track } from '../analytics/track';
import { describeBrief, type ThemeBrief } from '../theme/prompt/brief';
import { generateVariants, type GeneratedTheme } from '../theme/prompt/generateTheme';
import { interpretPrompt, MAX_PROMPT_LENGTH } from '../theme/prompt/interpretPrompt';
import type { LanguageDef } from '../data/languages';
import { padToMinLines } from '../theme/prompt/previewCode';
import { ThemePreview } from './ThemePreview';
import { CloseIcon, SparklesIcon } from './icons';
import { FOCUSABLE_SELECTOR } from './ConfirmDialog';

// Tapping a vibe writes its phrase into the box, so the text stays the one
// source of truth — a chip is just a shortcut for typing, never a hidden
// second setting. `group` makes opposites replace each other.
interface Vibe {
  label: string;
  phrase: string;
  group?: 'mode' | 'temperature';
}

const VIBES: Vibe[] = [
  { label: 'Easy on the eyes', phrase: 'easy on the eyes' },
  { label: 'Dark', phrase: 'dark', group: 'mode' },
  { label: 'Light', phrase: 'light theme', group: 'mode' },
  { label: 'Warm', phrase: 'warm', group: 'temperature' },
  { label: 'Cool', phrase: 'cool', group: 'temperature' },
  { label: 'Colorful', phrase: 'colorful' },
  { label: 'Muted', phrase: 'muted' },
  { label: 'High contrast', phrase: 'high contrast' },
  { label: 'Forest', phrase: 'forest' },
  { label: 'Ocean', phrase: 'ocean' },
  { label: 'Coffee', phrase: 'coffee' },
  { label: 'Sunset', phrase: 'sunset' },
];

const phraseRegex = (phrase: string) => new RegExp(`(^|[\\s,])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,])`, 'i');
const hasPhrase = (text: string, phrase: string) => phraseRegex(phrase).test(text);

function withoutPhrase(text: string, phrase: string): string {
  return text
    .replace(phraseRegex(phrase), '$1')
    .replace(/\s*,(\s*,)+/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

function toggleVibe(text: string, vibe: Vibe): string {
  if (hasPhrase(text, vibe.phrase)) return withoutPhrase(text, vibe.phrase);
  let next = text;
  if (vibe.group) {
    for (const other of VIBES) if (other.group === vibe.group && other !== vibe) next = withoutPhrase(next, other.phrase);
  }
  return next.trim() ? `${next.trim()}, ${vibe.phrase}` : vibe.phrase;
}

type Outcome = { kind: 'ok'; brief: ThemeBrief; interpreter: string } | { kind: 'unrecognized' };

/** A compact color chip for an option in the list: its background with the five main syntax colors on it. */
function OptionSwatch({ option }: { option: GeneratedTheme }) {
  const p = option.palette;
  return (
    <span className="describe-swatch" style={{ background: option.background }} aria-hidden="true">
      {[p.keywords, p.functions, p.strings, p.types, p.numbers].map((color, i) => (
        <span key={i} className="describe-swatch-dot" style={{ background: color }} />
      ))}
    </span>
  );
}

interface DescribeThemeDialogProps {
  onClose: () => void;
  /** Reports a human-readable success message after the chosen theme is applied. */
  onApplied?: (message: string) => void;
  /** True when applying would replace colors the user already set. */
  willReplaceTheme: boolean;
  /** The app's current sample, so the preview shows code you're already looking at — rendered by the same TextMate grammar and scope colors as the editor. */
  language: LanguageDef;
  code: string;
}

export function DescribeThemeDialog({ onClose, onApplied, willReplaceTheme, language, code }: DescribeThemeDialogProps) {
  const { importTheme } = useAssignments();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  // Bumped per keystroke so a slow interpreter (a future model-backed one) can't overwrite a newer result with an older one.
  const requestRef = useRef(0);

  const [prompt, setPrompt] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [selected, setSelected] = useState(0);

  const text = prompt.trim();

  useEffect(() => {
    const previouslyFocused = previouslyFocusedRef.current;
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Options appear as you type — the rules are instant, so there's no
  // Generate step. The short delay only keeps a future model-backed
  // interpreter from firing a request per keystroke.
  useEffect(() => {
    if (!text) return;
    const request = ++requestRef.current;
    const timer = setTimeout(async () => {
      const result = await interpretPrompt(text);
      if (request !== requestRef.current) return;
      setSelected(0);
      setOutcome(result.ok ? { kind: 'ok', brief: result.brief, interpreter: result.interpreter } : { kind: 'unrecognized' });
    }, 120);
    return () => clearTimeout(timer);
  }, [text]);

  const current = text ? outcome : null;
  const options = useMemo(() => (current?.kind === 'ok' ? generateVariants(current.brief) : []), [current]);
  const chosen = options[selected] ?? null;
  const previewCode = useMemo(() => padToMinLines(language, code), [language, code]);

  function apply() {
    if (!chosen || current?.kind !== 'ok') return;
    importTheme(chosen.theme);
    onApplied?.(`Applied "${chosen.name}".`);
    // Never the prompt text itself — only what kind of theme was made and by which interpreter.
    track('prompt_theme_applied', { mode: chosen.mode, interpreter: current.interpreter });
    onClose();
  }

  return (
    <div
      className="import-dialog-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="import-dialog describe-dialog" role="dialog" aria-modal="true" aria-labelledby="describe-dialog-title">
        <div className="import-dialog-header">
          <h2 id="describe-dialog-title" className="import-dialog-title">
            Describe your theme
          </h2>
          <button type="button" className="import-dialog-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="import-dialog-body describe-body">
          <input
            id="describe-prompt"
            className="describe-input"
            type="text"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={MAX_PROMPT_LENGTH}
            value={prompt}
            aria-label="Describe the theme you want"
            placeholder="e.g. dark and easy on the eyes"
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />

          <div className="describe-vibes" role="group" aria-label="Quick picks">
            {VIBES.map((vibe) => {
              const active = hasPhrase(text, vibe.phrase);
              return (
                <button key={vibe.label} type="button" className={active ? 'describe-chip describe-chip-active' : 'describe-chip'} aria-pressed={active} onClick={() => setPrompt(toggleVibe(prompt, vibe))}>
                  {vibe.label}
                </button>
              );
            })}
          </div>

          {!current && (
            <p className="describe-empty">
              <SparklesIcon size={14} /> Type a few words or tap some quick picks — options appear instantly.
            </p>
          )}

          {current?.kind === 'unrecognized' && (
            <p className="describe-empty" role="status">
              Hmm, nothing there I can work with yet. Try a mood (calm, cozy), a look (dark, light, high contrast), or a color or place (forest, ocean).
            </p>
          )}

          {options.length > 0 && current?.kind === 'ok' && (
            <div className="describe-results" aria-live="polite">
              <div className="describe-options" role="radiogroup" aria-label="Theme options">
                {options.map((option, i) => (
                  <label key={option.name} className={i === selected ? 'describe-option describe-option-selected' : 'describe-option'}>
                    <input type="radio" name="describe-option" className="visually-hidden" checked={i === selected} onChange={() => setSelected(i)} />
                    <OptionSwatch option={option} />
                    <span className="describe-option-name">{option.name}</span>
                  </label>
                ))}
                <p className="describe-summary">
                  {describeBrief(current.brief).join(' · ')}
                  {chosen && chosen.lowestContrast >= 4.4 && (
                    <span className="describe-check" title={`Text ${chosen.textContrast.toFixed(1)}:1 · weakest syntax color ${chosen.lowestContrast.toFixed(1)}:1 — WCAG AA asks for 4.5:1`}>
                      {' '}
                      ✓ easy to read
                    </span>
                  )}
                </p>
              </div>
              {chosen && (
                <div className="describe-preview" role="group" aria-label={`Code preview in ${chosen.name}`}>
                  <ThemePreview language={language} code={previewCode} variant={chosen.theme.variants[0]} keepWhileLoading />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="describe-footer">
          {willReplaceTheme && chosen ? <span className="describe-warning">Replaces your current theme.</span> : <span />}
          <div className="confirm-actions">
            <button type="button" className="confirm-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="confirm-confirm-btn" onClick={apply} disabled={!chosen}>
              Use this theme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
