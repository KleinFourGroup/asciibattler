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
  // 74e follow-up — a true terminal BLUE (user call: event nodes need their
  // own hue; "terminal blue for now"). Deliberately distinct from the cyan
  // FLOURESCENT_BLUE, which is spoken for as the map's frontier/clickable
  // STATE color — a kind accent in the same hue would read as actionable.
  // Bright enough to carry a 16px glyph on #000. Revisit with the §74i/§77
  // content rounds if the map palette gets crowded.
  TERMINAL_BLUE: '#3D7BFF',
  NEON_RED: '#FF3131', // User flagged this one as unsatisfying in the prior game — revisit.
  DARK_NEON_RED: '#990000',
  NEON_PURPLE: '#9D00FF',
  // Desaturated warm gray for environment entities (walls, future shrines).
  // Picked to read as "inert" — sits between TERMINAL_BLACK and
  // DARK_TERMINAL_AMBER on the warm axis, doesn't fight green/red for
  // attention. INERT neutrals also have bloom suppressed at the renderer
  // side so they don't compete with combatants for halo budget (§75h: an
  // ACTIVE neutral — a camp member, TERMINAL_AMBER — blooms like a
  // combatant; it's a fighter, not furniture).
  TERMINAL_STONE: '#7A7066',
  // §40c — a weathered ochre for DESTRUCTIBLE walls / half-cover. Warmer + more
  // saturated than the inert TERMINAL_STONE so a breakable obstacle reads as
  // cracked/mortared masonry, distinct at a glance from a permanent wall (which
  // shares its `#` / `╥` glyph) — the §40c "visual tell". Sits on the warm amber
  // axis (between TERMINAL_AMBER and DARK_TERMINAL_AMBER) so it doesn't fight the
  // green/red team colors for attention; inert neutrals keep bloom suppressed.
  // Distinct enough from the §75h camp TERMINAL_AMBER (#FFB000 — brighter,
  // fully saturated, blooming) that scenery and the third faction don't blur.
  CRACKED_STONE: '#B5843C',
} as const;

export type PaletteName = keyof typeof COLORS;
