/**
 * Phase Y2 — the caster-reposition primitive shared by the move interpreter and
 * the legacy `GambitStrikeAction` (a behavior-preserving extraction, so the
 * data-driven gambit and the hand-coded one compute the SAME step — the Y3
 * determinism oracle then proves the migration byte-identical).
 *
 * `retreatCell` is the gambit's conservative one-cell dart-back: the neighbor
 * that STRICTLY increases Chebyshev distance from the anchor (so a sideways /
 * closer step never reads as a "retreat"), tie-broken toward open space (the
 * candidate with the most free neighbors), then by fixed `NEIGHBORS` order for
 * determinism. Returns null when nothing qualifies (boxed in / corner / 1-wide
 * corridor) — the caller then holds position. Pure given the world snapshot.
 *
 * Cluster 2's `move` knockback/pull (target-moving) will live alongside this in
 * the hardened occupancy core; this round ships only caster-reposition.
 */

import type { GridCoord } from '../../core/types';
import type { Unit } from '../Unit';
import type { World } from '../World';
import { awayStep } from '../positioning';
import { GROUND, claimedCells, occupiedCells } from '../occupancy';

export function retreatCell(unit: Unit, anchor: GridCoord, world: World): GridCoord | null {
  // §35 — the occupancy chokepoint owns the "every OTHER unit" set (one cell per
  // unit today; the §39 footprint block for free).
  const occupied = occupiedCells(world, GROUND, { excludeId: unit.id });
  // §36b — a cell another unit has CLAIMED (its in-flight move destination) is
  // off-limits to the gambit dart-back too: this reposition writes `position`
  // instantly, so darting onto a claimed cell collides when the claimant's
  // deferred flip arrives. The unit's own claim (if mid-move) is excluded.
  // (The healer's `stepAwayFrom` twin deliberately does NOT fold claims — its
  // proposal-model step is §35b-guarded; see 44-pre-a.)
  for (const k of claimedCells(world, GROUND, { excludeId: unit.id })) occupied.add(k);

  // §44a — the strictly-away + open-space-tie geometry is the shared
  // `positioning.awayStep`; only the occupancy semantics live here.
  return awayStep(unit.position, anchor, world, occupied);
}
