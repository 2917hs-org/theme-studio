// A fixed, curated palette — not generated or ranked per mode. Deliberately
// shares colors with the "more colors" list below rather than avoiding
// overlap: both are meant to work together as one coherent syntax-highlight
// palette, and "Suggested" is just the first, most-reached-for slice of it.
const SUGGESTED_PALETTE: string[] = [
  '#e2e8f0', // Off White
  '#60a5fa', // Blue
  '#86efac', // Green
  '#c084fc', // Purple
  '#fbbf24', // Amber
  '#f472b6', // Pink
  '#22d3ee', // Cyan
  '#fb923c', // Orange
  '#a3e635', // Lime
  '#94a3b8', // Slate
];

const WIDE_PALETTE: string[] = [
  '#f8fafc', // White
  '#e2e8f0', // Light Slate
  '#cbd5e1', // Silver
  '#94a3b8', // Slate
  '#64748b', // Blue Gray
  '#60a5fa', // Blue
  '#3b82f6', // Bright Blue
  '#2563eb', // Royal Blue
  '#7dd3fc', // Sky Blue
  '#22d3ee', // Cyan
  '#2dd4bf', // Teal
  '#5eead4', // Aqua
  '#4ade80', // Green
  '#86efac', // Mint Green
  '#34d399', // Emerald
  '#a3e635', // Lime
  '#bef264', // Light Lime
  '#facc15', // Yellow
  '#fbbf24', // Amber
  '#fb923c', // Orange
  '#ea580c', // Deep Orange
  '#fdba74', // Peach
  '#f87171', // Red
  '#e11d48', // Crimson
  '#fb7185', // Rose
  '#f472b6', // Pink
  '#d946ef', // Magenta
  '#c084fc', // Purple
  '#a78bfa', // Violet
  '#818cf8', // Indigo
  '#c4b5fd', // Lavender
  '#6ee7b7', // Mint
  '#38bdf8', // Light Blue
  '#16a34a', // Forest Green
  '#b4b4be', // Neutral Gray
];

/** The 10-swatch curated palette — same set regardless of mode. */
export function quickPalette(): string[] {
  return SUGGESTED_PALETTE;
}

/** The 35-swatch broader curated palette — same set regardless of mode. */
export function widePalette(): string[] {
  return WIDE_PALETTE;
}
