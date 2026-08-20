import type { CSSProperties } from 'react';
import { LANGUAGES, type LanguageDef } from '../data/languages';
import { RefreshIcon } from './icons';

interface LanguagePickerProps {
  selected: LanguageDef;
  onSelect: (lang: LanguageDef) => void;
  onRegenerate: () => void;
}

export function LanguagePicker({ selected, onSelect, onRegenerate }: LanguagePickerProps) {
  return (
    <div className="language-picker">
      <div className="language-list">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            className={lang.id === selected.id ? 'lang-chip lang-chip-active' : 'lang-chip'}
            onClick={() => onSelect(lang)}
            aria-pressed={lang.id === selected.id}
            style={{ '--lang-accent': lang.accent } as CSSProperties}
          >
            <span className="lang-dot" />
            {lang.label}
          </button>
        ))}
      </div>
      <button id="tour-regenerate" className="regenerate-btn" onClick={onRegenerate} title="Generate a new code sample — your color assignments are kept">
        <RefreshIcon /> Regenerate sample
      </button>
    </div>
  );
}
