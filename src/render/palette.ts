// The palette. `COLORS` is the vocabulary code reaches for, and the single
// source of truth for every hue with a name.
//
// A palette is chosen by name at boot. `COLORS` is the chosen one:
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

const DEFAULT = {
  TERMINAL_BLACK: '#282828',
  TERMINAL_GREEN: '#33FF00',
  DARK_TERMINAL_GREEN: '#0A3300',
  TERMINAL_AMBER: '#FFB000',
  DARK_TERMINAL_AMBER: '#664600',
  FLOURESCENT_BLUE: '#15f4ee',
  DARK_FLOURESCENT_BLUE: '#034947',
  // A true terminal blue, the event nodes' own hue. Apart from the cyan
  // FLOURESCENT_BLUE, which the map spends on its frontier (clickable)
  // state: a node kind in the same hue would read as actionable. Bright
  // enough for the map node's 16 px glyph on #000 (a 5.5 : 1 contrast).
  TERMINAL_BLUE: '#3D7BFF',
  NEON_RED: '#FF3131',
  DARK_NEON_RED: '#990000',
  NEON_PURPLE: '#9D00FF',
  // A desaturated warm grey for scenery (walls), warmer than TERMINAL_BLACK
  // and cooler than DARK_TERMINAL_AMBER, picked to read as inert and not to
  // fight green and red for attention. Inert neutrals also draw with
  // no bloom, so they take no halo from the combatants; an active neutral (a
  // camp member, TERMINAL_AMBER) blooms like a combatant, being a fighter,
  // not furniture.
  TERMINAL_STONE: '#7A7066',
  // A weathered ochre for destructible walls and half-cover, warmer and more
  // saturated than TERMINAL_STONE, so a breakable obstacle reads as cracked
  // masonry, told at a glance from the permanent wall that shares its `#` or
  // `╥`. It sits on the warm amber axis, between TERMINAL_AMBER and
  // DARK_TERMINAL_AMBER, clear of the green and red teams, and apart enough
  // from the camp's TERMINAL_AMBER (brighter, fully saturated, blooming)
  // that scenery and the third faction don't blur.
  CRACKED_STONE: '#B5843C',

  // The shades: each a hue above, lighter or dimmer, so a palette that moves
  // the hue moves its shade with it. The hexes are the stylesheet's, as it
  // spelled them.
  AMBER_HOVER: '#ffd060',
  AMBER_DIM: '#997700',
  AMBER_FAINT: '#332300',
  GREEN_DIM: '#1a4d00',
  BLUE_DIM: '#0a6a66',
  BLUE_RULE: '#0e4f4c',
  BOSS_RED: '#ff3030',

  // The status and empower hues (statusDisplay.ts says which status or buff
  // wears each, and why the hues sit where they do). The behaviour statuses
  // and `honed` wear a hue from the first block.
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

type PaletteName = keyof typeof DEFAULT;

/** A palette: every name, each a `#rrggbb` hex. */
export type Palette = Readonly<Record<PaletteName, string>>;

/** The palette a page draws with when nothing chose another, and the one the
 *  stylesheet's own tokens spell. */
export const DEFAULT_PALETTE = 'default';

/**
 * The colourblind palette: the default with eighteen names moved.
 *
 * The gate (tests/palette-colourblind.test.ts, on every `npm test`): the five
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
 * Not gated, re-picked and reported (archive/post-109-worklog.md has the
 * tables):
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
