/**
 * 54f — CHOKE HOLD: priority #3. Trigger + proposal both read
 * `armyMinCut` (sensors): the smallest set of free cells the enemy must
 * cross to reach us — the width-tolerant replacement for the articulation
 * scan that read ZERO on the ≥2-wide isthmus bridge (BALANCE §54c).
 *
 * Fires when the funnel trade is on: a small cut exists (≤ `CHOKE_MAX_CUT`),
 * the enemy group OUTNUMBERS it by `CHOKE_OUTNUMBER_FACTOR`× (many of them,
 * few tiles — the isthmus signature: the session's highest enemy counts,
 * 8–12 all-melee, and the only cell where the human used `hold` at all),
 * and the cut sits STRICTLY on our side (if they already hold the bridge,
 * walking into it is an assault, not a choke hold). Proposal: `engage` on
 * the cut's central cell — the team plugs the gap and engage's targeting
 * fights whatever steps through. Release = the driver's null action when
 * the conditions break (they crossed, thinned, or took the choke first).
 *
 * On record (54f design conversation): the HUMAN's isthmus play was
 * actually a terrain-advantage hold — engaging with the enemy still in
 * accuracy-penalized shallow water — not a geometric plug. The geometric
 * funnel stands on its own; the water's-edge variant is a documented
 * candidate EXTENSION of terrain-edge hold (generalize hazard → combat-
 * penalty tiles), deliberately unbuilt while choke-isthmus shows no damage
 * gap (0.0 across human and both bot arms). Worklog §54f.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { distanceBetween, footprintOf } from '../../sim/occupancy';
import { isInertNeutral } from '../../sim/Unit';
import type { TrafficScript } from '../TrafficScriptDriver';
import { armyMinCut, livingUnits, opposingTeam } from '../sensors';

/** Largest cut worth plugging (also the sensor's early-bail bound). */
export const CHOKE_MAX_CUT = 3;

/** The funnel trade: enemies must outnumber the cut by this factor. */
export const CHOKE_OUTNUMBER_FACTOR = 2;

/** The cut's central cell: nearest the cut centroid, row-major on ties. */
export function cutCenter(cut: readonly GridCoord[]): GridCoord {
  const cx = cut.reduce((s, c) => s + c.x, 0) / cut.length;
  const cy = cut.reduce((s, c) => s + c.y, 0) / cut.length;
  let best = cut[0]!;
  let bestD = Infinity;
  for (const c of cut) {
    const d = Math.max(Math.abs(c.x - cx), Math.abs(c.y - cy));
    if (d < bestD || (d === bestD && (c.y < best.y || (c.y === best.y && c.x < best.x)))) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export interface ChokeRead {
  readonly cut: readonly GridCoord[];
  readonly proposal: TeamObjective;
}

/**
 * The geometric core shared by `evaluate` and `nominate`: a cut ≤
 * `CHOKE_MAX_CUT` exists and its center sits STRICTLY on our side (the 54d
 * diagonal-tie lesson applies here too) — without both there is no coherent
 * "plug OUR choke" proposal at all. One `armyMinCut` computation serves
 * both callers.
 *
 * 86c-L3 — this is the PURE compute (exported as the verifier surface, the
 * §79e principle: the memo below is checked against a recompute production
 * doesn't consult). Production callers go through the memoized `chokeRead`.
 */
export function computeChokeRead(world: World, team: ObjectiveTeam): ChokeRead | null {
  const enemies = livingUnits(world, opposingTeam(team));
  const own = livingUnits(world, team);
  if (own.length === 0 || enemies.length === 0) return null;
  const cut = armyMinCut(world, team, CHOKE_MAX_CUT);
  if (cut === null) return null;
  const center = cutCenter(cut);
  const minDist = (units: readonly { position: GridCoord }[]) =>
    units.reduce((m, u) => Math.min(m, distanceBetween(center, u.position)), Infinity);
  if (minDist(own) >= minDist(enemies)) return null;
  return { cut, proposal: { mode: 'engage', target: { kind: 'tile', cell: center } } };
}

/**
 * 86c-L3 — the EXACT-INPUT memo over `computeChokeRead`. The choke read was
 * 16.1% of the full-ARM run post-L2b (armyMinCut + its closures + this
 * file's reduces, recomputed every tick of every walker-rollout battle),
 * while its exact input vector repeats across 76.5% of consecutive battle
 * ticks (the L3 probe; 88.8% on isthmus, where choke actually fires) —
 * positions only flip at move-impact boundaries, walls never move.
 *
 * NOT a same-tick memo and NOT a hash: the key is an element-wise-compared
 * Int32Array of EVERY input the compute reads — the tile-mutation epoch
 * (`TileGrid.mutations`) plus, per unit in `world.units` order (order is an
 * input: it fixes `livingUnits`/edge insertion order, which fixes the
 * augmenting-path order the cut extraction depends on): id, team, position,
 * alive flag, footprint, inert-neutral flag. A hit therefore means the pure
 * function would return the identical value — semantic transparency by
 * construction, no staleness class to reason about. On a hit the PROPOSAL
 * is re-cloned (callers historically got a fresh object per call, and a
 * proposal flows into `world.objectives`); the cut array is shared
 * read-only (consumers only measure it).
 *
 * The memo is bot-layer state keyed per World INSTANCE (WeakMap — rollout
 * clones never share entries, worlds GC freely) and per team. sensors.ts'
 * "no internal caches" doctrine stands: `armyMinCut` itself is untouched —
 * the cache lives here at its one production consumer, with the pure
 * compute exported for the recompute-and-compare tests.
 */
interface ChokeMemoEntry {
  key: Int32Array;
  result: ChokeRead | null;
}
const chokeMemo = new WeakMap<World, Partial<Record<ObjectiveTeam, ChokeMemoEntry>>>();

/** Test-only counters — hit-rate visibility for the verifier suite. */
export const chokeMemoStats = { calls: 0, hits: 0 };

const TEAM_CODE = { player: 0, enemy: 1, neutral: 2 } as const;

function chokeKey(world: World): Int32Array {
  const units = world.units;
  const key = new Int32Array(1 + units.length * 7);
  key[0] = world.tileGrid.mutations;
  let i = 1;
  for (const u of units) {
    key[i++] = u.id;
    key[i++] = TEAM_CODE[u.team];
    key[i++] = u.position.x;
    key[i++] = u.position.y;
    key[i++] = u.currentHp > 0 ? 1 : 0;
    key[i++] = footprintOf(u);
    key[i++] = isInertNeutral(u) ? 1 : 0;
  }
  return key;
}

function sameKey(a: Int32Array, b: Int32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A fresh result object per call — exactly what the pure compute returned
 *  historically (the proposal may be stored in `world.objectives`; never
 *  hand out an object the memo also retains). */
function cloneRead(r: ChokeRead | null): ChokeRead | null {
  if (r === null) return null;
  const p = r.proposal;
  // By construction the compute only ever proposes engage:tile; the narrow
  // keeps the clone honest if that ever changes (tsc flags a new shape here).
  if (p.mode !== 'engage' || p.target.kind !== 'tile') return r;
  return {
    cut: r.cut,
    proposal: { mode: 'engage', target: { kind: 'tile', cell: { x: p.target.cell.x, y: p.target.cell.y } } },
  };
}

function chokeRead(world: World, team: ObjectiveTeam): ChokeRead | null {
  chokeMemoStats.calls++;
  const key = chokeKey(world);
  let byTeam = chokeMemo.get(world);
  if (byTeam === undefined) {
    byTeam = {};
    chokeMemo.set(world, byTeam);
  }
  const entry = byTeam[team];
  if (entry !== undefined && sameKey(entry.key, key)) {
    chokeMemoStats.hits++;
    return cloneRead(entry.result);
  }
  const result = computeChokeRead(world, team);
  byTeam[team] = { key, result };
  return cloneRead(result);
}

/**
 * 57g.4 — the propose-regardless nominator: the 2× outnumber "funnel trade"
 * is the go/no-go judgment the rollout arbitrates under audition; the
 * geometric core (cut exists, our side) is all that must hold. Same purity
 * contract as `evaluate`.
 */
export function nominateChokeHold(world: World, team: ObjectiveTeam): TeamObjective | null {
  return chokeRead(world, team)?.proposal ?? null;
}

export const chokeHold: TrafficScript = {
  id: 'choke-hold',
  evaluate(world: World, team: ObjectiveTeam): TeamObjective | null {
    const enemies = livingUnits(world, opposingTeam(team));
    if (enemies.length < CHOKE_OUTNUMBER_FACTOR) return null;
    const read = chokeRead(world, team);
    if (read === null) return null;
    if (enemies.length < read.cut.length * CHOKE_OUTNUMBER_FACTOR) return null;
    return read.proposal;
  },
};
