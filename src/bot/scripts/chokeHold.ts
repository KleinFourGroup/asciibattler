/**
 * Choke hold, third in priority. The trigger and the proposal both read
 * `armyMinCut` (sensors): the smallest set of free cells the enemy must
 * cross to reach us. A cut rather than an articulation point, so a bridge
 * two or more cells wide still reads.
 *
 * It fires when the funnel trade is on: a cut of at most `CHOKE_MAX_CUT`
 * cells exists, the enemy outnumbers it `CHOKE_OUTNUMBER_FACTOR` times
 * over (many of them, few tiles), and the cut sits strictly on our side
 * (if they already hold the bridge, walking into it is an assault, not a
 * hold). Proposal: `engage` on the cut's central cell, so the team plugs
 * the gap and engage's targeting fights whatever steps through. The
 * release is the driver's null action when a condition breaks: they
 * crossed, thinned, or took the choke first.
 */

import type { World } from '../../sim/World';
import type { GridCoord } from '../../core/types';
import type { ObjectiveTeam, TeamObjective } from '../../sim/objective';
import { distanceBetween } from '../../core/grid';
import { footprintOf } from '../../sim/occupancy';
import { isInertNeutral } from '../../sim/Unit';
import type { TrafficScript } from '../TrafficScriptDriver';
import { armyMinCut, livingUnits, opposingTeam } from '../sensors';

/** The largest cut worth plugging, and the flow past which the sensor
 *  stops. */
export const CHOKE_MAX_CUT = 3;

/** The funnel trade: enemies must outnumber the cut by this factor. */
export const CHOKE_OUTNUMBER_FACTOR = 2;

/** The cut's central cell: nearest the cut centroid, row-major on ties. */
function cutCenter(cut: readonly GridCoord[]): GridCoord {
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

interface ChokeRead {
  readonly cut: readonly GridCoord[];
  readonly proposal: TeamObjective;
}

/**
 * The geometric core `evaluate` and `nominate` share: a cut of at most
 * `CHOKE_MAX_CUT` exists, and its center sits strictly on our side, since
 * a Chebyshev tie leaks through a diagonal corner. Without both there is
 * no coherent proposal to plug our choke. One `armyMinCut` serves both.
 *
 * The pure compute, exported so the tests can check the memo below
 * against a recompute it does not consult; the scripts go through the
 * memoized `chokeRead`.
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
 * The exact-input memo over `computeChokeRead`. The choke read was 16.1 %
 * of a full run of the arbitrated arm (`armyMinCut`, its closures and this
 * file's reduces, recomputed every tick of every rollout battle), while
 * its exact input repeats across 76.5 % of consecutive battle ticks
 * (88.8 % on the isthmus, where the choke fires): positions change only
 * when a move lands, and walls never move.
 *
 * Not a same-tick memo and not a hash: the key is an Int32Array, compared
 * element by element, of every input the compute reads: the tile grid's
 * mutation count (`TileGrid.mutations`) and, per unit in `world.units`
 * order, its id, team, position, alive flag, footprint and inert-neutral
 * flag. The order is an input too: it fixes `livingUnits`' order and so the
 * order of the edges, which fixes the augmenting paths the cut is read
 * from. A hit means the pure function would return the same value, so the
 * memo cannot go stale. On a hit the proposal is cloned again, since a
 * proposal flows into `world.objectives`; the cut array is shared
 * read-only (callers only measure it).
 *
 * The memo is the bot's state, keyed per World instance (a WeakMap, so
 * rollout clones never share an entry and worlds are collected freely) and
 * per team. The sensors keep no cache: `armyMinCut` is untouched, and the
 * cache lives here at its one caller outside the tests.
 */
interface ChokeMemoEntry {
  key: Int32Array;
  result: ChokeRead | null;
}
const chokeMemo = new WeakMap<World, Partial<Record<ObjectiveTeam, ChokeMemoEntry>>>();

/** Counters for the tests' hit-rate check. */
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

/** A fresh result object per call, as the pure compute returns: the
 *  proposal may be stored in `world.objectives`, so never hand out an
 *  object the memo also holds. */
function cloneRead(r: ChokeRead | null): ChokeRead | null {
  if (r === null) return null;
  const p = r.proposal;
  // The compute proposes only engage on a tile, and the narrow lets the
  // clone name the cell. A proposal of another shape would be handed out
  // uncloned, with no type error to say so.
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
 * The audition nominator: the outnumbering, the funnel trade, is the
 * go/no-go call the rollouts make under the searcher, and only the
 * geometric core (a cut, on our side) must hold. The same purity as
 * `evaluate`.
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
