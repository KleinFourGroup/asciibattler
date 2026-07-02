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
  // Desaturated warm gray for environment entities (walls, future shrines).
  // Picked to read as "inert" — sits between TERMINAL_BLACK and
  // DARK_TERMINAL_AMBER on the warm axis, doesn't fight green/red for
  // attention. Neutrals also have bloom suppressed at the renderer side
  // so they don't compete with combatants for halo budget.
  TERMINAL_STONE: '#7A7066',
  // §40c — a weathered ochre for DESTRUCTIBLE walls / half-cover. Warmer + more
  // saturated than the inert TERMINAL_STONE so a breakable obstacle reads as
  // cracked/mortared masonry, distinct at a glance from a permanent wall (which
  // shares its `#` / `╥` glyph) — the §40c "visual tell". Sits on the warm amber
  // axis (between TERMINAL_AMBER and DARK_TERMINAL_AMBER) so it doesn't fight the
  // green/red team colors for attention; neutrals keep bloom suppressed.
  CRACKED_STONE: '#B5843C',
} as const;

export type PaletteName = keyof typeof COLORS;
