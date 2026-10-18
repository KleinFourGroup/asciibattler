/**
 * The board explorer's dial table and its URL codec (pure, headless-tested).
 * The explorer is a dev-only, render-only panel of live dials; a dial is one
 * row of `DIALS`, and everything else (the panel's controls, the typed
 * state, the `?bp=` bookmark) derives from that row, so a new dial is one
 * row here.
 *
 * The state lives in the URL (`?bp=yaw-30_pose-row`), never in `RunConfig`:
 * the run dials ship to players and ride the fuzz hook (src/run), and this
 * is `src/dev`, which only a DEV page loads (../devEntry.ts). Only
 * non-default values are written, so the default state is no param at all
 * and a bookmark names exactly what differs from today's board. Unknown keys
 * and values are dropped, as `layout=` drops an unknown id, never thrown on:
 * a stale bookmark degrades to defaults.
 *
 * Codec: pairs joined by `_`, key and value by the first `-` (so a later
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
  /** Which battle is on screen (fixtures.ts `BOARDS`). Unlike every other
   *  dial this one cannot apply live: the run dials it stands for are parsed
   *  inside `new Game`, so a change rewrites the URL and reloads, and boot.ts
   *  re-derives the run pairs from the table on every load. `off` = the
   *  panel leaves the run alone (your own `?seed=` and `?layout=` apply). */
  board: {
    kind: 'enum',
    label: 'board',
    options: ['off', ...BOARD_IDS],
    def: 'off',
    hint: 'a fixed battle, straight from boot — changing it RELOADS and replaces your run dials (seed, layout, roster…)',
  },
  /** The projection, through the explorer's one production seam
   *  (`Renderer.setCameraView`). The defaults are `DEFAULT_CAMERA_VIEW`
   *  (state.test.ts pins the four against it), so an untouched panel never
   *  calls the seam with anything but today's camera. */
  proj: {
    kind: 'enum',
    label: 'projection',
    options: ['persp', 'ortho'],
    def: 'ortho',
    hint: 'persp = a lens (see FOV) · ortho = parallel rays: no lean, no far-row shrink',
  },
  fov: {
    kind: 'range',
    label: 'FOV',
    min: 10,
    max: 70,
    step: 1,
    def: 50,
    hint: 'vertical degrees, perspective only (the pre-7.5 lens was 50); a long lens is 10-25 (the camera backs off to keep the fit)',
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
    def: 45,
    hint: 'degrees about the vertical — 45 = the diamond board (shipped); 0 = square to the board',
  },
  /** The glyph scale: a multiplier on every unit body's quad. Units only:
   *  walls, projectiles and markers keep their size, so a wall run never
   *  overlaps itself and the read is about the units. Threaded through the
   *  mirror pick (`enemyBillboards`, `destructibleBillboards`) and the two
   *  unit lifts (`inkTopLift`, `inkCenterLift`), so bars, hitsplats, FX
   *  endpoints and click boxes stay glued to the bigger glyph. */
  scale: {
    kind: 'range',
    label: 'glyph scale',
    min: 0.5,
    max: 2,
    step: 0.05,
    def: 1,
    hint: 'unit bodies only (walls stay one tile) — bars, hitsplats and click boxes follow',
  },
  /** The shipped ground marks, drawn by the terrain. Off = the plain terrain
   *  shaders, the frame-cost bench's before leg. */
  marks: {
    kind: 'bool',
    label: 'terrain marks',
    def: true,
    hint: 'the shipped marks, drawn by the terrain - off = the plain terrain shader',
  },
  /** The plate corner radius (`MarkStyle.plateCorner`). Square shipped; the
   *  rounding is for organic scenery such as trees (TODO). The default is the
   *  shipped style's (state.test.ts). */
  plateCorner: {
    kind: 'range',
    label: 'plate corner',
    min: 0,
    max: 0.3,
    step: 0.01,
    def: 0,
    hint: 'the plate corner radius, world units - 0 = square; a large radius drifts toward the player circle',
  },
  /** The posed fixtures (fixtures.ts `placePose`): render-only sprites with
   *  real overlay bars, on whatever board is up. `row` is `g ▄ ╥ M a r`; the
   *  clumps and the flyer are the board geometry tests'
   *  (tests/board/geometry.ts), cell for cell. */
  pose: {
    kind: 'enum',
    label: 'pose',
    options: ['off', ...POSE_IDS],
    def: 'off',
    hint: 'row = g ▄ ╥ M a r · clump = centre + near corner + far row · edges = corners + mids · flyer = V over three far neighbours',
  },
  /** The fake flyer's camera-up lift, world units. At yaw 45 and pitch 45,
   *  1.0 lands it on its diagonal neighbour: √2 of ground behind it, which
   *  the pitch foreshortens by sin 45° to 1.0 up the screen. */
  lift: {
    kind: 'range',
    label: 'flyer lift',
    min: 0,
    max: 2,
    step: 0.05,
    def: 1,
    hint: 'camera-up, in tiles — the flyer pose only',
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
 * `location.search`, leaving every other pair byte for byte as the user
 * typed it. `URLSearchParams.set` would re-serialize the whole query, and
 * turn a hand-typed `roster=a,b` into `roster=a%2Cb` on the first dial
 * change.
 */
export function spliceBookmark(search: string, encoded: string): string {
  const kept = (search.startsWith('?') ? search.slice(1) : search)
    .split('&')
    .filter((pair) => pair !== '' && pair.split('=')[0] !== BOARD_PANEL_PARAM);
  if (encoded !== '') kept.push(`${BOARD_PANEL_PARAM}=${encoded}`);
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}

/** The four projection dials as the Renderer's `CameraView`. Structural on
 *  purpose, so state.ts stays free of render imports: index.ts hands it to
 *  seams.ts's `applyCameraView`, typed as `Renderer.setCameraView`'s
 *  argument, where tsc checks the shape. */
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
 * The known cosmetic artefacts of a dialled board, shown on the panel so a
 * read discounts them instead of filing them. Each is a seam the dev dials
 * reach and production does not: an artefact of the shipped board itself
 * belongs in TODO, not here. Text only: the panel renders it, and
 * state.test.ts pins that none is empty.
 */
export const KNOWN_ARTEFACTS: readonly string[] = [
  'any dial change: an FX already in flight (bolt, lob, splat) was lifted on the OLD camera-up and lands there; the next one is right',
  'glyph scale: the fit box is one tile tall, so a scaled far-row glyph can graze the frame margin',
  'glyph scale: the objective marker keeps its own size; only its target lifts',
  'glyph scale: posed units and live units scale; a posed sprite still has no click box',
];
