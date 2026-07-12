/**
 * 53e — the battle gauntlet's cell catalog (the shape-locked 10-cell list,
 * worklog §53 shape-lock table): 4 reaction-time killer cells + 5 traffic
 * showcases + 1 boss cell, × 3 fixed seeds each ≈ the 1-hour human session.
 *
 * A cell is a PINNED battle context: encounter × layout × seed, launched as a
 * minimal run (`hops`) with `daemon=none` (no pre-turn grant choices — the
 * human's and the bot's turn-1 BattleEncounter are identical, the paired-seed
 * contract). The SAME `RunConfig` drives both sides: `cellUrl` is what the
 * human opens in the browser (53d's `?encounter=` param), `cellRunConfig`
 * is what the headless driver feeds `runOne` — one source of truth, zero
 * drift between what each side plays.
 *
 * Cell kinds and their run shapes:
 * - `normal`  — `hops: 2`: the forced encounter fires at the ROOT node (kind
 *   `battle`); the cell is that first encounter. (The run continues to a boss
 *   the cell ignores — the human may quit after the cell encounter resolves.)
 * - `boss`    — `hops: 2`: the forced encounter fires at the TERMINAL boss
 *   node; the root battle before it is pool-rolled — an arrival-state
 *   impurity shared by both sides (documented, accepted at 53e).
 * - `elite`   — `hops: 4`: elites only exist as scattered map nodes, and the
 *   scatter's min-spacing means a 3-hop map can never host one (seed-scan
 *   verified). Seeds are picked so the elite exists and is reachable; the
 *   driver's bad-seed warning guards regressions. The bot walks
 *   `path:elite`; the human protocol: enter the `*` node.
 */

import type { RunConfig } from '../../src/run/RunConfig';
import { runConfigToQueryString } from '../../src/run/RunConfig';
import type { EncounterKind } from '../../src/config/encounters';

export interface GauntletCell {
  /** Short stable slug — the reporting + `--cell=` filter key. */
  readonly id: string;
  readonly encounterId: string;
  readonly layoutId: string;
  /** The encounter's catalog kind (cross-checked by cells.test) — decides the
   *  run shape (see the header). */
  readonly kind: EncounterKind;
  /** Total hops for the cell's minimal run (2 = root + terminal). */
  readonly hops: number;
  /** Three fixed seeds — the paired-seed axis. Unique across the catalog. */
  readonly seeds: readonly [number, number, number];
  /** What this cell measures (from the shape-locked table). */
  readonly why: string;
}

export const GAUNTLET_CELLS: readonly GauntletCell[] = [
  {
    id: 'alpha-funnel',
    encounterId: 'ronin-vs-mages',
    layoutId: 'strafingFunnel',
    kind: 'normal',
    hops: 2,
    seeds: [101, 102, 103],
    why: 'Named killer: adjacent-spawn alpha strike (ronin+mages, funnel spawns)',
  },
  {
    id: 'alpha-spiral',
    encounterId: 'ronin-vs-mages',
    layoutId: 'spiralFireLife',
    kind: 'normal',
    hops: 2,
    seeds: [201, 202, 203],
    why: 'The adjacent-spiral spawn variant of the alpha strike',
  },
  {
    id: 'artillery-funnel',
    encounterId: 'artillery',
    layoutId: 'strafingFunnel',
    kind: 'normal',
    hops: 2,
    seeds: [301, 302, 303],
    why: 'Named killer: "Artillery Company on Strafing Funnel" (catapult wave)',
  },
  {
    id: 'junction-elite',
    encounterId: 'brigand-champions',
    layoutId: 'junctionAmbush',
    kind: 'elite',
    // hops 4, not 3: the elite scatter's min-spacing means a 3-hop map can
    // NEVER host an elite (a 401–460 seed scan found zero at hops=3, eight
    // at hops=4). These three seeds are scan-verified to place a reachable
    // elite; the driver's bad-seed warning guards against regression.
    hops: 4,
    seeds: [407, 409, 416],
    why: 'Named killer: junction ambush vs heavies (elite; enter the * node)',
  },
  {
    id: 'unjam-corridors',
    encounterId: 'brigands',
    layoutId: 'endlessCorridors',
    kind: 'normal',
    hops: 2,
    seeds: [501, 502, 503],
    why: 'Traffic: unjam — mixed melee+ranged jam in the corridors',
  },
  {
    id: 'fire-edge',
    encounterId: 'elementalTrio',
    layoutId: 'spiralFireLife',
    kind: 'normal',
    hops: 2,
    seeds: [601, 602, 603],
    why: 'Traffic: terrain-edge hold — stop short of the burning spiral',
  },
  {
    id: 'choke-isthmus',
    encounterId: 'highwaymen',
    layoutId: 'isthmus',
    kind: 'normal',
    hops: 2,
    seeds: [701, 702, 703],
    why: 'Traffic: choke hold — all-melee on the land bridge',
  },
  {
    id: 'stall-spiral',
    encounterId: 'adventurer-with-guards',
    layoutId: 'spiralFireLife',
    kind: 'normal',
    hops: 2,
    seeds: [801, 802, 803],
    why: 'Traffic: attrition stall — the opposite-spawn burn cheese',
  },
  {
    id: 'focus-river',
    encounterId: 'elementalTrio',
    layoutId: 'river',
    kind: 'normal',
    hops: 2,
    seeds: [901, 902, 903],
    why: 'Traffic: cohesion focus — assassinate the catapult across the river',
  },
  {
    id: 'boss-fortress',
    encounterId: 'bandit-king',
    layoutId: 'desertFortress',
    kind: 'boss',
    hops: 2,
    seeds: [1001, 1002, 1003],
    why: 'The boss cell — boss-wall relevance, exercises the stages grammar',
  },
];

/** The one RunConfig both sides play (see the header for why `daemon: null`). */
export function cellRunConfig(cell: GauntletCell, seed: number): RunConfig {
  return {
    seed,
    hopCount: cell.hops,
    forcedEncounterId: cell.encounterId,
    forcedLayoutId: cell.layoutId,
    daemon: null,
  };
}

/** The human session's launch URL for one cell × seed (53g's protocol list). */
export function cellUrl(cell: GauntletCell, seed: number, base = 'http://localhost:5173/'): string {
  return `${base}?${runConfigToQueryString(cellRunConfig(cell, seed))}`;
}
