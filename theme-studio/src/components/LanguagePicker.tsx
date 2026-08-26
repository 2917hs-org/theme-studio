import type { CSSProperties } from 'react';
import { LANGUAGES, type LanguageDef } from '../data/languages';

interface LanguagePickerProps {
  selected: LanguageDef;
  onSelect: (lang: LanguageDef) => void;
}

export function LanguagePicker({ selected, onSelect }: LanguagePickerProps) {
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
    </div>
  );
}
