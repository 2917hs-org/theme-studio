import type { ThemeMode } from './mode';

export interface ThemePreset {
  id: string;
  name: string;
  mode: ThemeMode;
  background: string;
  text: string;
  comments: string;
  keywords: string;
  strings: string;
  functions: string;
  /** Not every preset defines a numbers color — applying one without it clears any existing assignment. */
  numbers?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-navy',
    name: 'Dark Navy',
    mode: 'dark',
    background: '#0f172a',
    text: '#e2e8f0',
    comments: '#94a3b8',
    keywords: '#c084fc',
    strings: '#86efac',
    functions: '#60a5fa',
    numbers: '#fbbf24',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    background: '#0a0f19',
    text: '#dbeafe',
    comments: '#7e97b4',
    keywords: '#facc15',
    strings: '#4ade80',
    functions: '#60a5fa',
  },
  {
    id: 'soft-light',
    name: 'Soft Light',
    mode: 'light',
    background: '#f8fafc',
    text: '#1e293b',
    comments: '#64748b',
    keywords: '#7c3aed',
    strings: '#166534',
    functions: '#2563eb',
  },
  {
    id: 'ocean-dark',
    name: 'Ocean Dark',
    mode: 'dark',
    background: '#0b1e2d',
    text: '#dce6f0',
    comments: '#7c9bb0',
    keywords: '#7dd3fc',
    strings: '#7ee8b0',
    functions: '#ffb86b',
    numbers: '#ffd166',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    mode: 'dark',
    background: '#1c1c1c',
    text: '#e6e6e6',
    comments: '#9a9a9a',
    keywords: '#ff8f7e',
    strings: '#8fe28f',
    functions: '#7fc4ff',
    numbers: '#ffb366',
  },
  {
    id: 'sandstone-light',
    name: 'Sandstone Light',
    mode: 'light',
    background: '#fbf7f0',
    text: '#2b2320',
    comments: '#7a6f60',
    keywords: '#b34700',
    strings: '#2f6f4e',
    functions: '#1d5c9e',
    numbers: '#8a4b00',
  },
  {
    id: 'glacier-light',
    name: 'Glacier Light',
    mode: 'light',
    background: '#eef3f8',
    text: '#16232f',
    comments: '#54677a',
    keywords: '#4338ca',
    strings: '#0f7a52',
    functions: '#1d4ed8',
    numbers: '#b3480a',
  },
];

/** The scope each preset field maps onto — broad top-level TextMate families so every sub-variant (e.g. every comment style) inherits it. */
export const PRESET_SCOPES = {
  comments: 'comment',
  keywords: 'keyword',
  strings: 'string',
  functions: 'entity.name.function',
  numbers: 'constant.numeric',
} as const;
