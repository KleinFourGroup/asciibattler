/**
 * Hand-authored encounter layouts (C1b). Each layout pins a specific
 * tactical situation onto the arena — a chokepoint, a flanking diamond,
 * etc. — so the player encounters set-piece challenges between the more
 * varied procedural fights.
 *
 * Picking strategy: `Run` rolls one RNG step at battle setup. ~50% of
 * battles get `layoutId = null` (procedural via the existing density-
 * driven generator in terrainGen.ts); the other ~50% pick uniformly from
 * `LAYOUT_IDS`. The library deliberately starts small (two entries) — a
 * larger one would dilute each pick and reduce repeated exposure to any
 * given tactical lesson before the player has internalized it.
 *
 * Coordinate assumptions: every layout is hand-authored against a
 * 12×12 grid with `spawnRowsClear = [1, 2, 9, 10]`. The dispatcher throws
 * on mismatched grid sizes rather than silently scaling — layouts are
 * design artifacts, not parametric machinery. When grid size changes
 * (future C1c work), layouts get re-authored.
 *
 * Future-extension hook: water tiles aren't in any current layout, but
 * `LayoutDef.water` is ready for them. C1b focuses on wall topology; the
 * generator's procedural water placement (currently uniform-random, see
 * TODO #C1a-water) gets a separate pass.
 */

import type { GridCoord } from '../core/types';

export interface LayoutDef {
  readonly id: string;
  readonly walls: readonly GridCoord[];
  readonly water?: readonly GridCoord[];
}

/**
 * Corridor: two horizontal wall bands at rows 4 and 7 with a 4-cell gap
 * down the middle. Forces both armies through a chokepoint, which
 * advantages ranged units from the back rank and rewards melee that
 * commits to the gap first.
 */
const CORRIDOR: LayoutDef = {
  id: 'corridor',
  walls: [
    // Row 4: solid cols 0–3 and 8–11; gap at cols 4–7.
    { x: 0, y: 4 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
    { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 }, { x: 11, y: 4 },
    // Row 7: mirror.
    { x: 0, y: 7 }, { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 },
    { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 },
  ],
};

/**
 * Diamond: a 4×4 block in the center (with the corners knocked off) that
 * forces armies to flank one side or the other. Ranged LOS from the back
 * rank is broken across the middle of the board; melee have to commit to
 * a flank.
 */
const DIAMOND: LayoutDef = {
  id: 'diamond',
  walls: [
    { x: 5, y: 4 }, { x: 6, y: 4 },
    { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
    { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
    { x: 5, y: 7 }, { x: 6, y: 7 },
  ],
};

/**
 * Registered layouts. Order is stable (drives `rng.pick`) — appending new
 * layouts is fine; reordering changes the determinism of past seeds.
 */
export const LAYOUT_IDS = ['corridor', 'diamond'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

const LAYOUTS: Record<LayoutId, LayoutDef> = {
  corridor: CORRIDOR,
  diamond: DIAMOND,
};

/**
 * Look up a layout by id. Returns `undefined` for unknown ids — callers
 * (currently just `generateTerrain`) decide whether that's an error or
 * just a fallback to procedural.
 */
export function getLayout(id: string): LayoutDef | undefined {
  return (LAYOUTS as Record<string, LayoutDef | undefined>)[id];
}
