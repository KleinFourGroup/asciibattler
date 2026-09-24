/**
 * 105b — the board explorer's DIAL TABLE + its URL codec (pure, headless-
 * tested). The projection spike (Round 7.5, §105) is a dev-only, render-only
 * panel of live dials; a dial is one row of `DIALS`, and everything else — the
 * panel's controls, the typed state, the `?bp=` bookmark — derives from that
 * row, so 105d/105e add a projection or glyph-scale dial as one line here.
 *
 * The state lives in the URL (`?bp=anchor-bottom_bar-uniform`), NEVER in
 * `RunConfig`: the run dials ship to players and ride the fuzz hook
 * (src/run), this is `src/dev`, referenced only from main.ts's DEV block.
 * Only NON-default values are written, so the default state is no param at
 * all and a bookmark names exactly what differs from today's board. Unknown
 * keys / values are dropped (the `layout=` unknown-token discipline), never
 * thrown on — a stale bookmark degrades to defaults.
 *
 * Codec: pairs joined by `_`, key and value by the FIRST `-` (so a later
 * negative number survives); every character used is one URLSearchParams
 * leaves unescaped (`-`, `_`, `.`, alphanumerics), so the address bar stays
 * readable. Keys therefore never contain `_` or `-`.
 */

import { BOARD_IDS, POSE_IDS } from './fixtures';

export type DialSpec =
  | {
      readonly kind: 'enum';
      readonly label: string;
      readonly options: readonly string[];
      readonly def: string;
      readonly hint?: string;
    }
  | {
      readonly kind: 'range';
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly def: number;
      readonly hint?: string;
    }
  | {
      readonly kind: 'bool';
      readonly label: string;
      readonly def: boolean;
      readonly hint?: string;
    };

export const DIALS = {
  /** 105c — WHICH BATTLE is on screen (fixtures.ts `BOARDS`). Unlike every
   *  other dial this one cannot apply live: the run dials it stands for are
   *  parsed inside `new Game`, so a change rewrites the URL and RELOADS, and
   *  boot.ts re-derives the run pairs from the table on every load. `off` = the
   *  panel leaves the run alone (your own `?seed=` / `?layout=` apply). */
  board: {
    kind: 'enum',
    label: 'board',
    options: ['off', ...BOARD_IDS],
    def: 'off',
    hint: 'a fixed battle, straight from boot — changing it RELOADS and replaces your run dials (seed, layout, roster…)',
  },
  /** 105d — THE PROJECTION, through the phase's one production seam
   *  (`Renderer.setCameraView`). The defaults ARE `DEFAULT_CAMERA_VIEW`
   *  (state.test.ts pins the four against it), so an untouched panel never
   *  calls the seam with anything but today's camera. */
  proj: {
    kind: 'enum',
    label: 'projection',
    options: ['persp', 'ortho'],
    def: 'persp',
    hint: 'persp = a lens (see FOV) · ortho = parallel rays: no lean, no far-row shrink',
  },
  fov: {
    kind: 'range',
    label: 'FOV',
    min: 10,
    max: 70,
    step: 1,
    def: 50,
    hint: 'vertical degrees, perspective only — today 50; a long lens is 10-25 (the camera backs off to keep the fit)',
  },
  pitch: {
    kind: 'range',
    label: 'pitch',
    min: 20,
    max: 80,
    step: 1,
    def: 45,
    hint: 'degrees down from level — today 45; steeper = more map-like, shallower = rows hide rows',
  },
  yaw: {
    kind: 'range',
    label: 'yaw',
    min: -90,
    max: 90,
    step: 5,
    def: 0,
    hint: 'degrees about the vertical — 45 = the diamond board',
  },
  /** 105e — THE GLYPH SCALE: a multiplier on every UNIT BODY's quad (user-
   *  signed: units only — walls, projectiles and markers stay size 1, so a
   *  wall run never overlaps itself and the read is about the units). Threaded
   *  through the mirror pick (`enemyBillboards` / `destructibleBillboards`)
   *  and the two unit lifts (`inkTopLift` · `inkCenterLift`), so bars,
   *  hitsplats, FX endpoints and click boxes stay glued to the bigger glyph. */
  scale: {
    kind: 'range',
    label: 'glyph scale',
    min: 0.5,
    max: 2,
    step: 0.05,
    def: 1,
    hint: 'unit bodies only (walls stay one tile) — bars, hitsplats and click boxes follow',
  },
  /** The stand line: today's per-class rule (letterforms on the terminal-cell
   *  line, blocks on the quad bottom) vs ONE rule — the quad bottom for all.
   *  The H1 read: can the classifier / descender room / baseline go? */
  anchor: {
    kind: 'enum',
    label: 'anchor',
    options: ['today', 'bottom'],
    def: 'today',
    hint: 'today = the per-class stand line · bottom = every quad stands on its bottom edge',
  },
  /** The HP-bar line: today's ink-top follow (the user's §79e reversal) vs one
   *  uniform line across a row of mixed glyphs (§79d2's original call). */
  bar: {
    kind: 'enum',
    label: 'bar line',
    options: ['ink', 'uniform'],
    def: 'ink',
    hint: 'ink = each bar rides its own ink top (79e) · uniform = one line for every glyph',
  },
  /** Where the uniform line sits, in CELL units above the quad bottom (so it
   *  is independent of the anchor dial). 0.9 = just clear of the cap-height ink
   *  top (57/64 of a cell, measured) — pinned by state.test.ts. */
  barY: {
    kind: 'range',
    label: 'uniform line',
    min: 0.5,
    max: 1.2,
    step: 0.01,
    def: 0.9,
    hint: 'cell units above the quad bottom — 0.90 just clears a capital letter',
  },
  /** The ground-cue mock: a flat shape on the unit's tile, one SHAPE per side
   *  (circle = yours · diamond = enemy · triangle = camp) so it survives the
   *  grey read by construction. */
  cue: {
    kind: 'enum',
    label: 'ground cue',
    options: ['off', 'outline', 'filled'],
    def: 'off',
    hint: 'circle = yours · diamond = enemy · triangle = camp',
  },
  cueSize: { kind: 'range', label: 'cue size', min: 0.4, max: 1.1, step: 0.05, def: 0.8 },
  cueAlpha: { kind: 'range', label: 'cue opacity', min: 0.1, max: 1, step: 0.05, def: 0.55 },
  /** 105b-post (the user's read) — is the cue IN the world or ON it? `world`
   *  depth-tests it, so a taller tile nearer the camera occludes it like any
   *  ground (honest depth; read as "clipping" — and the amount is
   *  pitch-dependent, so it would bias the cross). `overlay` draws it over the
   *  terrain, always whole, glyphs still on top. A treatment, not a bug fix. */
  cueDepth: {
    kind: 'enum',
    label: 'cue depth',
    options: ['overlay', 'world'],
    def: 'overlay',
    hint: 'overlay = always whole, drawn over terrain · world = taller near tiles occlude it',
  },
  /** 106c — THE GROUND MARK (the §105 verdict's finding 1: "floaty" is a
   *  grounding question). `cue` is 105b's behaviour exactly (the cue dials
   *  decide), so an untouched panel still draws no mark. groundCue.ts. */
  ground: {
    kind: 'enum',
    label: 'ground mark',
    options: ['cue', 'shadow', 'both', 'merged'],
    def: 'cue',
    hint: 'cue = the team shape (cue dials) · shadow = a dark contact disc · both = the two · merged = ONE mark: the team shape at contact size, dark-filled, colour-outlined',
  },
  /** The contact mark's size (tile units) — the shadow disc and the merged mark. */
  shadowSize: { kind: 'range', label: 'contact size', min: 0.3, max: 1, step: 0.05, def: 0.55 },
  /** The contact mark's darkness — the shadow disc and the merged fill (the filled plate has its own, `plateAlpha`). */
  shadowAlpha: { kind: 'range', label: 'contact opacity', min: 0.1, max: 0.9, step: 0.05, def: 0.45 },
  /** 106c — the FOOTPRINT PLATE under a static N×N body (rubble): which tiles it
   *  holds (the user's 105b read, deferred to §106 on purpose — TODO). */
  plate: {
    kind: 'enum',
    label: 'NxN plate',
    options: ['off', 'frame', 'filled'],
    def: 'off',
    hint: 'frame = the footprint outlined in the body colour · filled = a dark footprint under that outline',
  },
  /** 106c-post — the user's item 5 ("we definitely want to try this"): the
   *  plate under EVERY scenery body, not just the N×N slabs. A grid square, so
   *  it collides with no team shape. */
  plateScope: {
    kind: 'enum',
    label: 'plate under',
    options: ['nxn', 'all'],
    def: 'nxn',
    hint: 'nxn = the rubble slabs only · all = every scenery body (walls, cover, 1x1 rubble)',
  },
  /** 106c-post — the filled plate's own darkness (the user darkened it at the
   *  106c read; 0.6 is a guess at "slightly darker" than the contact 0.45). */
  plateAlpha: { kind: 'range', label: 'plate opacity', min: 0.1, max: 0.95, step: 0.05, def: 0.6 },
  /** 106c-post2 — the step-face drape (the user's one refinement at the
   *  106c-post read): marks and plates continue down the vertical faces where
   *  their tile meets a lower one, on the faces the camera can see. conform.ts. */
  drape: {
    kind: 'bool',
    label: 'step drape',
    def: false,
    hint: 'marks and plates hang down the step faces the camera can see',
  },
  /** 105c — the posed fixtures (fixtures.ts `placePose`): render-only sprites
   *  with real overlay bars, on whatever board is up. `row` is 105b's
   *  `g ▄ ╥ M a r`; the clumps and the flyer are 105a's, cell for cell. */
  pose: {
    kind: 'enum',
    label: 'pose',
    options: ['off', ...POSE_IDS],
    def: 'off',
    hint: 'row = g ▄ ╥ M a r · clump = centre + near corner + far row · edges = corners + mids · flyer = V over three far neighbours',
  },
  /** The fake flyer's camera-up lift, world units (105a measured 1.0: at yaw 45
   *  / pitch 45 that lands it exactly ON its diagonal neighbour). */
  lift: {
    kind: 'range',
    label: 'flyer lift',
    min: 0,
    max: 2,
    step: 0.05,
    def: 1,
    hint: 'camera-up, in tiles — the flyer pose only',
  },
  shadow: {
    kind: 'bool',
    label: 'flyer shadow',
    def: true,
    hint: 'a dark disc on the tile the flyer is over',
  },
  /** Bookmark-only: the panel starts collapsed (the dials still apply). */
  hide: { kind: 'bool', label: 'start hidden', def: false },
} as const satisfies Record<string, DialSpec>;

export type DialKey = keyof typeof DIALS;

type ValueOf<S> = S extends { kind: 'enum'; options: readonly (infer O)[] }
  ? O
  : S extends { kind: 'range' }
    ? number
    : boolean;

export type DialState = { -readonly [K in DialKey]: ValueOf<(typeof DIALS)[K]> };

export const DIAL_KEYS = Object.keys(DIALS) as DialKey[];

/** The URL parameter the bookmark rides. */
export const BOARD_PANEL_PARAM = 'bp';

export function defaultDials(): DialState {
  const out: Record<string, string | number | boolean> = {};
  for (const key of DIAL_KEYS) out[key] = DIALS[key].def;
  return out as DialState;
}

/** Coerce one raw token to the dial's domain, or `undefined` if it does not
 *  belong there (unknown enum member, non-finite number, a non-0/1 bool). A
 *  range value is clamped and snapped to the dial's step. */
export function coerceDial(key: DialKey, raw: string): string | number | boolean | undefined {
  const spec: DialSpec = DIALS[key];
  if (spec.kind === 'enum') return spec.options.includes(raw) ? raw : undefined;
  if (spec.kind === 'bool') return raw === '1' ? true : raw === '0' ? false : undefined;
  const n = Number(raw);
  if (raw === '' || !Number.isFinite(n)) return undefined;
  const clamped = Math.min(spec.max, Math.max(spec.min, n));
  const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
  return Number(snapped.toFixed(6));
}

function isDialKey(key: string): key is DialKey {
  return Object.prototype.hasOwnProperty.call(DIALS, key);
}

/** `null` / `''` ⇒ the defaults. */
export function parseDials(param: string | null): DialState {
  const state = defaultDials() as Record<string, string | number | boolean>;
  if (!param) return state as DialState;
  for (const pair of param.split('_')) {
    const cut = pair.indexOf('-');
    if (cut <= 0) continue;
    const key = pair.slice(0, cut);
    if (!isDialKey(key)) continue;
    const value = coerceDial(key, pair.slice(cut + 1));
    if (value !== undefined) state[key] = value;
  }
  return state as DialState;
}

/** The non-default dials, in table order; `''` when the state IS the default. */
export function encodeDials(state: DialState): string {
  const pairs: string[] = [];
  for (const key of DIAL_KEYS) {
    const value = state[key];
    if (value === DIALS[key].def) continue;
    pairs.push(`${key}-${typeof value === 'boolean' ? (value ? '1' : '0') : String(value)}`);
  }
  return pairs.join('_');
}

/**
 * Replace (or drop, when `encoded` is `''`) the `bp` pair in a raw
 * `location.search`, leaving EVERY other pair byte-for-byte as the user typed
 * it. `URLSearchParams.set` would re-serialize the whole query — it turned a
 * hand-typed `roster=a,b` into `roster=a%2Cb` on the first dial change (105b).
 */
export function spliceBookmark(search: string, encoded: string): string {
  const kept = (search.startsWith('?') ? search.slice(1) : search)
    .split('&')
    .filter((pair) => pair !== '' && pair.split('=')[0] !== BOARD_PANEL_PARAM);
  if (encoded !== '') kept.push(`${BOARD_PANEL_PARAM}=${encoded}`);
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}

/** The four projection dials as the Renderer's `CameraView` (105d). Structural
 *  on purpose — state.ts stays free of render imports; index.ts hands it to
 *  `Renderer.setCameraView`, where tsc checks the shape. */
export function cameraViewOf(state: Pick<DialState, 'proj' | 'fov' | 'pitch' | 'yaw'>): {
  projection: 'perspective' | 'orthographic';
  fovDeg: number;
  pitchDeg: number;
  yawDeg: number;
} {
  return {
    projection: state.proj === 'ortho' ? 'orthographic' : 'perspective',
    fovDeg: state.fov,
    pitchDeg: state.pitch,
    yawDeg: state.yaw,
  };
}

export const VIEW_DIALS: readonly DialKey[] = ['proj', 'fov', 'pitch', 'yaw'];

/**
 * 105e — THE KNOWN COSMETIC ARTEFACTS of a dialled board, shown on the panel
 * so the user's read discounts them instead of filing them. Each is a seam the
 * spike deliberately did not touch (the charter: nothing ships, no rule
 * deletion yet); the phase that ships a direction fixes the ones it inherits.
 * Text only — the panel renders it, state.test.ts pins that none is empty.
 */
export const KNOWN_ARTEFACTS: readonly string[] = [
  'yaw: WASD / edge-scroll pan along WORLD axes (scroll mode), so W is no longer screen-up',
  'yaw: wall runs (#) staircase on diamond tiles; an NxN slab is a screen rectangle over a wider footprint',
  'any dial change: an FX already in flight (bolt, lob, splat) was lifted on the OLD camera-up and lands there; the next one is right',
  'glyph scale: the fit box is one tile tall, so a scaled far-row glyph can graze the frame margin',
  'glyph scale: the objective marker keeps its own size; only its target lifts',
  'glyph scale: posed units and live units scale; a posed sprite still has no click box',
  'ortho / long lens: the mist around the board is the apron ray, re-derived for parallel rays but read by no eye before yours',
  'ground mark: marks and plates are cut per tile onto the tile TOPS, and step drape = on hangs them down the step faces the camera sees - neither follows the hill mounds',
];

/**
 * THE bar-line rule, in one place: the camera-up lift (world units at size 1;
 * callers scale by footprint × the 105e glyph scale, and pass the SIZE-1
 * `inkTopLift` — the atlas instance is scale-patched by seams.ts) from a glyph's ground anchor to where its
 * overlay stack sits. `inkTopLift` is today's answer (the atlas's, measured);
 * the uniform line is `barY` cell units above the QUAD BOTTOM, which is
 * `barY - 0.5` in quad-local y, minus wherever this glyph's anchor sits —
 * so it stays one screen line across glyphs under either anchor mode. Both
 * the BattleRenderer patch and the posed row call this; neither re-derives it.
 */
export function barLift(
  state: Pick<DialState, 'bar' | 'barY'>,
  inkTopLift: number,
  baseAnchorY: number,
): number {
  return state.bar === 'ink' ? inkTopLift : state.barY - 0.5 - baseAnchorY;
}
