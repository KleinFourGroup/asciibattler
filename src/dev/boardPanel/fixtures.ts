/**
 * The board explorer's fixtures (pure, headless-tested): the fixed things a
 * bookmark is read against. Two tables.
 *
 * - `BOARDS`, which battle is on screen. A board fixture is a set of the
 *   shipped run dials (`seed=…&layout=…`, src/run/RunConfig.ts) plus what
 *   they must open (`expect`, the known answer, pinned headless through the
 *   real `Run` in fixtures.test.ts and checked again live by the loader).
 *   The run dials are parsed inside `new Game`, before the panel exists, so
 *   the fixture cannot be applied after boot: `bp=board-<id>` is the one
 *   source, and `fixtureSearch` rewrites the run pairs from this table
 *   before Game reads them (boot.ts). A fixture that opens a different board
 *   on reload is wrong, and a hand-edited `seed=` next to a `board-` cannot
 *   cause it. Every fixture pins `roster=` as well, since the enemy budget
 *   scales with the roster (`encounters/wave.ts`; 8 enemies against 5 on the
 *   same seed, measured).
 * - Poses, render-only posed sprites on whatever board is up: the three
 *   clumps and the flyer are the board geometry tests' cell for cell
 *   (tests/board/geometry.ts `clumpAt`, and the flyer at the centre with its
 *   three far neighbours), so what the eye reads is what that instrument
 *   measures. A pose lands on its ideal cells when they are clear and on the
 *   nearest clear fit otherwise, and says so (`notes`), because a displaced
 *   clump is not the measured one.
 */

import type { Team } from '../../sim/Unit';

// --- boards ------------------------------------------------------------------

export const BOARD_IDS = ['open15', 'quarry', 'corridors', 'big24', 'live', 'wade'] as const;
export type BoardId = (typeof BOARD_IDS)[number];

export interface BoardFixture {
  readonly label: string;
  /** Shipped run dials, as a query string without the `?`. */
  readonly run: string;
  /** Park the pre-battle countdown (Space still starts the fight). */
  readonly park: boolean;
  readonly expect: {
    readonly layoutId: string | null;
    readonly gridW: number;
    readonly gridH: number;
  };
}

/** `firstNode=elite` makes the root a battle (an unpinned root is the sector's
 *  starting event); `character=` skips the select screen. */
const RUN_BASE =
  'character=soldier&firstNode=elite&roster=mercenary,archer,rogue,healer,mage,catapult';

export const BOARDS: Record<BoardId, BoardFixture> = {
  // The pose host, at 15×15, the geometry tests' reference size: of the 43
  // seeds in 1..600 that roll 15×15, none hosts every pose on its measured
  // spot (a team spawns where the far-row clump goes); seed 91 is the first
  // of two where that clump is the only thing that moves, pinned by the test.
  open15: {
    label: 'procedural 15x15 (the 105a reference size, the pose host)',
    run: `seed=91&layout=procedural&${RUN_BASE}`,
    park: true,
    expect: { layoutId: null, gridW: 15, gridH: 15 },
  },
  quarry: {
    label: 'Rubble Quarry 14x12 (multi-tile bodies, a camp)',
    run: `seed=7&layout=rubbleQuarry&${RUN_BASE}`,
    park: true,
    expect: { layoutId: 'rubbleQuarry', gridW: 14, gridH: 12 },
  },
  corridors: {
    label: 'Endless Corridors 12x32 (the deepest board)',
    run: `seed=7&layout=endlessCorridors&${RUN_BASE}`,
    park: true,
    expect: { layoutId: 'endlessCorridors', gridW: 12, gridH: 32 },
  },
  // No authored 24×24 exists; procedural rolls 12..24 square
  // (`config/terrain.json`), and seed 10 is the first of 30 in 1..400 that
  // rolls the maximum.
  big24: {
    label: 'procedural 24x24 (the largest square, by seed hunt)',
    run: `seed=10&layout=procedural&${RUN_BASE}`,
    park: true,
    expect: { layoutId: null, gridW: 24, gridH: 24 },
  },
  // The same fight under every bookmark: the sim is deterministic in the seed
  // and no render dial reaches it. Not parked: the normal 5 s countdown runs.
  live: {
    label: 'River 12x12, LIVE (the countdown runs)',
    run: `seed=7&layout=river&${RUN_BASE}`,
    park: false,
    expect: { layoutId: 'river', gridW: 12, gridH: 12 },
  },
  // The hop's read. A diagonal between two water tiles slides past a land
  // corner standing 0.1 to 0.4 world above it (`TerrainRenderer.heightAt`),
  // which a hop would arc over; `live`'s fight has no such move. Seed 1 had the
  // most of 12 icebergs seeds in a headless hunt: 25, the first 2.9 s in.
  // Kept for the movement polish, which reopens the hop (TODO).
  wade: {
    label: 'Icebergs 16x16, LIVE (units wade diagonally past the floes: the hop read)',
    run: `seed=1&layout=icebergs&${RUN_BASE}`,
    park: false,
    expect: { layoutId: 'icebergs', gridW: 16, gridH: 16 },
  },
};

/** The run-dial keys a fixture owns (RUN_CONFIG_PARAMS, restated: importing
 *  src/run here would put the run layer in the panel's boot path). Pinned
 *  equal to the real table by fixtures.test.ts. */
export const RUN_DIAL_KEYS = [
  'seed',
  'hops',
  'sectorHops',
  'roster',
  'layout',
  'encounter',
  'firstNode',
  'event',
  'script',
  'width',
  'daemon',
  'character',
  'bits',
  'escalation',
] as const;

/**
 * A raw `location.search` with its run dials replaced by `board`'s (or just
 * dropped, for `null`), every other pair, `bp` included, byte for byte where
 * it was. Idempotent: a search that already is the fixture's comes back
 * equal, which is how boot.ts knows not to touch the URL.
 */
export function fixtureSearch(search: string, board: BoardId | null): string {
  const owned = new Set<string>(RUN_DIAL_KEYS);
  const kept = (search.startsWith('?') ? search.slice(1) : search)
    .split('&')
    .filter((pair) => pair !== '' && !owned.has(pair.split('=')[0]!));
  const pairs = board === null ? kept : [...BOARDS[board].run.split('&'), ...kept];
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

// --- poses -------------------------------------------------------------------

export const POSE_IDS = ['row', 'clump', 'edges', 'flyer'] as const;
export type PoseId = (typeof POSE_IDS)[number];

/** A posed sprite's identity, structurally a `MarkSubject` (render/groundMarks.ts). */
export interface PosedSpec {
  readonly glyph: string;
  readonly team: Team;
  readonly archetype: string;
  readonly campId: number | null;
  /** HP shown on the bar, below 1 so a destructible's bar shows. */
  readonly hp: number;
  readonly destructible: boolean;
}

interface Placement {
  readonly spec: PosedSpec;
  readonly cell: { readonly x: number; readonly y: number };
  /** Rides the `lift` dial (camera-up); its ground mark stays on its tile. */
  readonly flies: boolean;
}

/** What placement needs to know about the board. `isClear` = a posed sprite may
 *  stand there (passable, dry, no live unit); out-of-bounds is never asked. */
export interface PoseBoard {
  readonly gridW: number;
  readonly gridH: number;
  isClear(x: number, y: number): boolean;
}

const fighter = (glyph: string, team: Team, archetype: string): PosedSpec => ({
  glyph,
  team,
  archetype,
  campId: null,
  hp: 0.7,
  destructible: false,
});
const block = (glyph: string, archetype: string): PosedSpec => ({
  glyph,
  team: 'neutral',
  archetype,
  campId: null,
  hp: 0.6,
  destructible: true,
});

/** The row `g ▄ ╥ M a r`: an enemy, two blocks, two players, an enemy, so
 *  every side's cue shape stands beside another side's. */
export const POSED_ROW: readonly PosedSpec[] = [
  fighter('g', 'enemy', 'ghoul'),
  block('▄', 'rubble_1x1'),
  block('╥', 'half_cover_destructible'),
  fighter('M', 'player', 'mercenary'),
  fighter('a', 'player', 'archer'),
  fighter('r', 'enemy', 'rogue'),
];

/** The geometry tests' `CLUMP_GLYPHS`, in their row-major order (pinned
 *  equal by the test). A melee clump is both sides interleaved. */
export const CLUMP: readonly PosedSpec[] = (
  [
    ['M', 'mercenary'],
    ['g', 'ghoul'],
    ['a', 'archer'],
    ['@', 'mercenary'],
    ['W', 'warlock'],
    ['r', 'rogue'],
    ['s', 'shaman'],
    ['h', 'healer'],
    ['b', 'banshee'],
  ] as const
).map(([glyph, archetype], i) => fighter(glyph, i % 2 === 0 ? 'player' : 'enemy', archetype));

const EDGE_GLYPHS: readonly (readonly [string, string])[] = [
  ['M', 'mercenary'],
  ['g', 'ghoul'],
  ['a', 'archer'],
  ['W', 'warlock'],
  ['r', 'rogue'],
  ['h', 'healer'],
  ['b', 'banshee'],
  ['s', 'shaman'],
];

/** The flyer is `V`, as in the geometry tests, and the units behind it `M`. */
const FLYER = fighter('V', 'player', 'reaver');
const BEHIND = fighter('M', 'enemy', 'mercenary');

type Cell = { x: number; y: number };

/** The anchor nearest (ax, ay) — Chebyshev rings, row-major within a ring, so
 *  the answer is deterministic — at which every `offsets` cell is on the board
 *  and clear. */
function nearestFit(
  board: PoseBoard,
  ax: number,
  ay: number,
  offsets: readonly Cell[],
  clear: (x: number, y: number) => boolean,
): Cell | null {
  const fits = (x: number, y: number): boolean =>
    offsets.every((o) => {
      const cx = x + o.x;
      const cy = y + o.y;
      return cx >= 0 && cy >= 0 && cx < board.gridW && cy < board.gridH && clear(cx, cy);
    });
  const reach = Math.max(board.gridW, board.gridH);
  for (let ring = 0; ring <= reach; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        if (fits(ax + dx, ay + dy)) return { x: ax + dx, y: ay + dy };
      }
    }
  }
  return null;
}

const SQUARE3: readonly Cell[] = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y })));

interface PoseResult {
  readonly placements: readonly Placement[];
  /** One line per group: where it landed, and whether that is the ideal spot. */
  readonly notes: readonly string[];
}

/** Grid y = 0 is the camera-near row (render `gridToWorld`), as in the
 *  geometry tests. */
export function placePose(pose: PoseId, board: PoseBoard): PoseResult {
  const placements: Placement[] = [];
  const notes: string[] = [];
  const used = new Set<string>();
  const clear = (x: number, y: number): boolean => !used.has(`${x},${y}`) && board.isClear(x, y);
  const cx = Math.floor(board.gridW / 2);
  const cy = Math.floor(board.gridH / 2);

  const group = (
    name: string,
    ax: number,
    ay: number,
    offsets: readonly Cell[],
    specs: readonly PosedSpec[],
    flies: (i: number) => boolean = () => false,
  ): void => {
    const at = nearestFit(board, ax, ay, offsets, clear);
    if (at === null) {
      notes.push(`${name}: NO clear fit on this board`);
      return;
    }
    offsets.forEach((o, i) => {
      const cell = { x: at.x + o.x, y: at.y + o.y };
      used.add(`${cell.x},${cell.y}`);
      placements.push({ spec: specs[i % specs.length]!, cell, flies: flies(i) });
    });
    const moved = at.x !== ax || at.y !== ay;
    notes.push(
      `${name} @${at.x},${at.y}${moved ? ` (MOVED from ${ax},${ay} - not the measured spot)` : ''}`,
    );
  };

  if (pose === 'clump') {
    // The geometry tests' three: the centre, the near-left corner, the far row.
    group('centre', cx, cy, SQUARE3, CLUMP);
    group('near corner', 1, 1, SQUARE3, CLUMP);
    group('far row', cx, board.gridH - 2, SQUARE3, CLUMP);
  } else if (pose === 'edges') {
    const w = board.gridW - 1;
    const h = board.gridH - 1;
    const spots: readonly (readonly [string, number, number])[] = [
      ['near-left', 0, 0],
      ['near-right', w, 0],
      ['far-left', 0, h],
      ['far-right', w, h],
      ['near-mid', cx, 0],
      ['far-mid', cx, h],
      ['left-mid', 0, cy],
      ['right-mid', w, cy],
    ];
    spots.forEach(([name, x, y], i) => {
      const [glyph, archetype] = EDGE_GLYPHS[i]!;
      group(
        name,
        x,
        y,
        [{ x: 0, y: 0 }],
        [fighter(glyph, i % 2 === 0 ? 'player' : 'enemy', archetype)],
      );
    });
  } else if (pose === 'flyer') {
    // The flyer, then the three units in the row behind it (y + 1 is farther):
    // under yaw, "up the screen" lands on a diagonal one, the case a single
    // neighbour straight behind would miss.
    group(
      'flyer',
      cx,
      cy,
      [
        { x: 0, y: 0 },
        { x: -1, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      [FLYER, BEHIND, BEHIND, BEHIND],
      (i) => i === 0,
    );
  } else {
    // The first run of six, centred-out on each row, from the middle row
    // toward the camera (under a perspective lens a near row is the biggest
    // on screen, for reads a few atlas pixels wide), then away.
    const run = POSED_ROW.map((_, i) => ({ x: i, y: 0 }));
    const start = Math.max(0, Math.floor((board.gridW - run.length) / 2));
    const rows: number[] = [];
    for (let y = cy; y >= 0; y--) rows.push(y);
    for (let y = cy + 1; y < board.gridH; y++) rows.push(y);
    let placed = false;
    for (const y of rows) {
      for (let offset = 0; offset <= board.gridW && !placed; offset++) {
        for (const x0 of offset === 0 ? [start] : [start - offset, start + offset]) {
          if (x0 < 0 || x0 + run.length > board.gridW) continue;
          if (!run.every((o) => clear(x0 + o.x, y))) continue;
          run.forEach((o, i) =>
            placements.push({ spec: POSED_ROW[i]!, cell: { x: x0 + o.x, y }, flies: false }),
          );
          notes.push(`row y=${y}, x=${x0}..${x0 + run.length - 1}`);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) notes.push('row: no clear run of six dry tiles on this board');
  }
  return { placements, notes };
}
