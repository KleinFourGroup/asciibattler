// The COLORS enum; single source of truth for the palette.
// Hex values pulled from the user's previous game (rogue-terminal/src/colors.ts).
// May still be tuned at CHECKPOINT 3 once the post-process pipeline is in place.

export const COLORS = {
  TERMINAL_BLACK: '#282828',
  TERMINAL_GREEN: '#33FF00',
  DARK_TERMINAL_GREEN: '#0A3300',
  TERMINAL_AMBER: '#FFB000',
  DARK_TERMINAL_AMBER: '#664600',
  FLOURESCENT_BLUE: '#15f4ee',
  DARK_FLOURESCENT_BLUE: '#034947',
  NEON_RED: '#FF3131', // User flagged this one as unsatisfying in the prior game — revisit.
  DARK_NEON_RED: '#990000',
  NEON_PURPLE: '#9D00FF',
} as const;

export type PaletteName = keyof typeof COLORS;
