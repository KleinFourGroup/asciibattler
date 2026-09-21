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
  | { readonly kind: 'bool'; readonly label: string; readonly def: boolean; readonly hint?: string };

export const DIALS = {
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
  /** The posed row `g ▄ ╥ M a r` — render-only sprites with real overlay bars,
   *  on the first clear floor row near the board centre. */
  row: { kind: 'bool', label: 'posed row', def: false, hint: 'g ▄ ╥ M a r, with real bars' },
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

/**
 * THE bar-line rule, in one place: the camera-up lift (world units at size 1;
 * callers scale by footprint) from a glyph's ground anchor to where its
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
