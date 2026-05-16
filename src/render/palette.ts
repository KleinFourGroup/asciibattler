// The COLORS enum; single source of truth for the palette.
// Defined here so Step 0.2 can pull TERMINAL_BLACK as the scene clear color.

export const COLORS = {
  TERMINAL_BLACK: '#000000',
  TERMINAL_GREEN: '#00ff66',
  DARK_TERMINAL_GREEN: '#006633',
  TERMINAL_AMBER: '#ffb000',
  DARK_TERMINAL_AMBER: '#805800',
  FLOURESCENT_BLUE: '#33ccff',
  DARK_FLOURESCENT_BLUE: '#1a6680',
  NEON_RED: '#ff3333',
  DARK_NEON_RED: '#801a1a',
  NEON_PURPLE: '#cc33ff',
} as const;

export type PaletteName = keyof typeof COLORS;
