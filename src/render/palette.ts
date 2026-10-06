// THE PALETTE. `COLORS` is the vocabulary code reaches for, and the single
// source of truth for every hue with a name.
//
// 116f — A PALETTE IS CHOSEN BY NAME AT BOOT. `COLORS` is the chosen one:
// the settings' boot (src/settings/boot.ts, `main.ts`'s second import) calls
// `choosePalette` with the stored name before any module that reads `COLORS`
// is evaluated, and the binding below is live, so those modules read the
// chosen palette as they load. Several of them bake a colour into a table or
// a `THREE.Color` at that moment (statusDisplay.ts, TerrainRenderer.ts, the
// HP gradient), which is why the choice is made once, at boot, and a change
// to the Palette setting applies on reload. Nothing else may call
// `choosePalette`: a module evaluated before the call keeps what it read
// (palette.test.ts shows it), and tests/settings-boot.test.ts holds this
// module in the boot's import graph with no import of its own.
//
// The stylesheet mirrors every name as a `--color-<kebab>` token, at the
// default palette's hex (tests/ui-tokens.test.ts pins the two equal), so the
// sheet stands alone. For any other palette the boot sets the tokens that
// differ over the sheet's (`tokenOverrides`).
//
// A second palette is a second table in `PALETTES`, with every name. The
// Palette setting's choices (src/settings/settings.ts, `PALETTE_CHOICES`) are
// the names here, held equal by tests/palette-colourblind.test.ts.

// Hex values pulled from the user's previous game (rogue-terminal/src/colors.ts).
const DEFAULT = {
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

  // 116f — THE SHADES the stylesheet held as its own tokens: each is a hue
  // above, lighter or dimmer, so a palette that moves the hue has to move
  // its shade with it. The hexes are the sheet's, as it spelled them.
  AMBER_HOVER: '#ffd060',
  AMBER_DIM: '#997700',
  AMBER_FAINT: '#332300',
  GREEN_DIM: '#1a4d00',
  BLUE_DIM: '#0a6a66',
  BLUE_RULE: '#0e4f4c',
  BOSS_RED: '#ff3030',

  // 116f — THE STATUS AND EMPOWER HUES (statusDisplay.ts says which status
  // or buff wears each, and why the hues sit where they do). The behaviour
  // statuses and `honed` wear a hue from the first block.
  EMBER_ORANGE: '#FF6A00', // burn — hotter than amber
  BLOOD_CRIMSON: '#D41E3A', // bleed — deeper than NEON_RED
  TOXIC_GREEN: '#8FC31F', // poison — a yellow-green
  REGEN_GREEN: '#2BE57A', // rejuvenate
  BUFF_GOLD: '#FFD700', // emboldened
  MARCH_GREEN: '#B4FF6E', // inspired — a pale spring-green
  AEGIS_LAVENDER: '#C9D1FF', // warded
  PARTY_PINK: '#FF7AD9', // hyped
  SHIELD_STEEL: '#6FA8FF', // shielded
  VOLT_YELLOW: '#F4FF3D', // overclocked
} as const;

export type PaletteName = keyof typeof DEFAULT;

/** A palette: every name, each a `#rrggbb` hex. */
export type Palette = Readonly<Record<PaletteName, string>>;

/** The palette a page draws with when nothing chose another, and the one the
 *  stylesheet's own tokens spell. */
export const DEFAULT_PALETTE = 'default';

/**
 * 116g — THE COLOURBLIND PALETTE: the default with eighteen names moved.
 *
 * THE GATE (tests/palette-colourblind.test.ts, on every `npm test`): the five
 * hues the board tells its bodies apart by (yours, the enemy's, a camp's,
 * stone, cracked stone) are at least 0.130 apart, pair by pair, to normal
 * vision and under each simulation of protanopia, deuteranopia and
 * tritanopia, as hexes and as the canvas draws them. 0.130 is the default
 * palette's own closest such pair to normal vision. The default fails it on
 * four pairs: a deuteranope sees your green and the camp's amber 0.050 apart.
 * Three names carry the gate (the search that chose them found no passing
 * palette that moves fewer): yours goes to a mint, the enemy's to a hot pink,
 * and stone a step darker. Amber and cracked stone stay.
 *
 * NOT GATED, re-picked and reported (WORKLOG §116g has the tables):
 *   - the cyan moves toward blue and darkens, since the mint landed 0.015
 *     from it; it is now 0.10 from the mint and still vivid;
 *   - seven status and empower hues move, by a search for the least move
 *     that keeps every pair of status hues, and every pair of empower hues,
 *     0.070 apart in each view (the default's closest pair is 0.003). Their
 *     guarantee is not the hue: a status has its symbol and its name
 *     (statusDisplay.ts);
 *   - a shade follows its hue: its own lightness, its chroma scaled as the
 *     hue's was, its hue turned by as much.
 */
const COLOURBLIND: Palette = {
  ...DEFAULT,
  TERMINAL_GREEN: '#46FBAE',
  DARK_TERMINAL_GREEN: '#0A311F',
  GREEN_DIM: '#184B30',
  NEON_RED: '#F942B2',
  DARK_NEON_RED: '#8F035D',
  BOSS_RED: '#ED33A7',
  TERMINAL_STONE: '#71675D',
  FLOURESCENT_BLUE: '#0CC7F3',
  DARK_FLOURESCENT_BLUE: '#124655',
  BLUE_DIM: '#1E6679',
  BLUE_RULE: '#194C5A',
  EMBER_ORANGE: '#FD6F55', // a step toward coral, clear of poison's green for a deuteranope
  TOXIC_GREEN: '#50A725', // darker and greener: the default sits on the camp's amber for a protanope
  REGEN_GREEN: '#06EFA5',
  MARCH_GREEN: '#B7FF8A',
  AEGIS_LAVENDER: '#CED5FE',
  PARTY_PINK: '#FE8ACF', // lighter, clear of the enemy's pink
  SHIELD_STEEL: '#6A9DFE',
};

/** The palettes this build has, by the name the Palette setting stores. */
export const PALETTES: ReadonlyMap<string, Palette> = new Map([
  [DEFAULT_PALETTE, DEFAULT],
  ['colourblind', COLOURBLIND],
]);

/** The chosen palette. A live binding: `choosePalette` re-points it. */
export let COLORS: Palette = DEFAULT;
let chosenName: string = DEFAULT_PALETTE;

/**
 * Choose the page's palette: `name`'s, or the default's when this build has
 * no palette of that name (a stored name from another build must not leave
 * the page without colours). The boot's call, made once, before any module
 * that reads `COLORS` is evaluated. `palettes` is a test's seam.
 */
export function choosePalette(name: string, palettes: ReadonlyMap<string, Palette> = PALETTES): Palette {
  const palette = palettes.get(name);
  COLORS = palette ?? DEFAULT;
  chosenName = palette === undefined ? DEFAULT_PALETTE : name;
  return COLORS;
}

/** The name of the palette the page is drawn in: the one the boot chose, or
 *  the default's when it chose none this build has. The Palette row reads it
 *  to say whether a stored choice still waits for a reload. */
export function chosenPalette(): string {
  return chosenName;
}

/** The stylesheet's token for a palette name: `TERMINAL_GREEN` is
 *  `--color-terminal-green`. */
export function paletteToken(name: PaletteName): string {
  return `--color-${name.toLowerCase().replace(/_/g, '-')}`;
}

/**
 * The tokens a palette sets over the stylesheet's own: one per name whose
 * hex is not the default's, so the default palette sets none and the sheet's
 * values stand as they are written.
 */
export function tokenOverrides(palette: Palette): Array<readonly [token: string, hex: string]> {
  const names = Object.keys(DEFAULT) as PaletteName[];
  return names
    .filter((name) => palette[name].toLowerCase() !== DEFAULT[name].toLowerCase())
    .map((name) => [paletteToken(name), palette[name]] as const);
}
