/**
 * 85d — the campRaid battle order + eligibility gate (round-6-spec §"The ε
 * re-read + the two riders"): the player-side mirror of the §75g enemy
 * pull, shared by the LIVE harness and the rollout walker so both sides
 * issue the identical order (one definition — a divergence here would be
 * a live-vs-rollout coherence bug, not a baseline coupling; the walker's
 * deliberate-duplication doctrine covers the battle wiring, not new
 * shared leaves).
 *
 * The order: an ordered ENGAGE on the first living camp member at spawn
 * time — deterministic and draw-free (movement's no-RNG doctrine; at
 * spawn the only living camp units are the PRIMED ones, one per camp
 * instance, so "first living" = a primed member in spawn order — the
 * §75h materialize-instantly rails). The camp is NOT pre-marked hostile:
 * hostility keeps its single source (damage aggro), the pull's exact
 * contract — the raid reads passive until first blow, then cascades.
 * "Raid first, then fight": a foreign standing order holds both bot
 * driver tiers (the searcher's §54 foreign-order conservatism + the 85d
 * traffic guard); the sim's dead-target auto-revert releases them.
 *
 * No-op (returns false) on a board with no living camp unit — a
 * procedural board can roll campless past the eligibility gate, and an
 * order against nothing would just loiter (the 75h2 skip rule).
 */

import type { World } from '../../src/sim/World';
import { getLayout } from '../../src/config/layouts';

/** Enumerate the raid candidate only where camps can exist: an AUTHORED
 *  layout gates on its campSpawns (a campless board buys no rollouts); an
 *  unresolvable id (the procedural sentinel, synthetic tests) stays
 *  eligible — camps are theme-rolled at spawn there, and a campless roll
 *  makes the raid arm ≡ null (ties→NULL, rollout cost only). */
export function campRaidEligible(layoutId: string | undefined): boolean {
  if (layoutId === undefined) return true;
  const def = getLayout(layoutId);
  if (def === undefined) return true;
  return (def.campSpawns?.length ?? 0) > 0;
}

/** Issue the raid order against a freshly spawned world. Returns whether
 *  an order was placed (false = campless board, nothing enqueued). */
export function orderCampRaid(world: World): boolean {
  // ⚠ `campId !== null`, matching the sim's own neutral-target validity
  // read (World.clearResolvedObjectives): non-camp units carry campId
  // NULL, not undefined — an `!== undefined` filter matches EVERY unit
  // and hands the order a player-unit id, which the sim silently reverts
  // the same tick (caught by the 85d A/B probe; the unit test's
  // camp-only fixture couldn't see it — now it spawns a player unit
  // first).
  const mark = world.units.find((u) => u.campId !== null && u.currentHp > 0);
  if (mark === undefined) return false;
  // The SETUP-PHASE door, not the command queue: an enqueued order drains
  // AFTER tick 0's bot decides, so a driver that decided under the
  // still-atWill objective clobbered the plan in the same drain (the 85d
  // A/B probe — 8/12 pairs byte-equal). Direct-set at spawn, the order
  // stands before any decide and both driver tiers' foreign-order
  // conservatism holds until the dead-target auto-revert.
  world.setInitialObjective('player', {
    mode: 'engage',
    target: { kind: 'neutral', unitId: mark.id },
  });
  return true;
}
