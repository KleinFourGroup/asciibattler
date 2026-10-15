/**
 * An `AbilityDef`'s timeline in ticks. Defs are authored in seconds and the
 * sim runs in ticks; this is the pure conversion `(def, speed) → ticks`.
 *
 * A def's busy window is usually scaled by speed (`attackCooldownTicksFor`),
 * with fixed phases (a wind-up, a projectile's travel) carved out of it and one
 * elastic `'fill'` phase taking the rest, which is why a timeline is not a
 * flat record of authored seconds. A def with no `'fill'` phase (the dash, whose
 * cooldown is also flat, `speedScaled: false`) has a busy window that is the
 * sum of its fixed phases, apart from its cooldown.
 *
 * A fixed phase may also set `scalesWithSpeed`, so it shrinks with the caster's
 * `speed` on the cadence's curve instead of staying constant: a charged spell's
 * wind-up then stays a short tell that tracks the cadence across the speed
 * range, where a constant one would put a floor under the cadence.
 */

import type { ActionPhase } from '../Action';
import { secondsToTicks } from '../../config';
import { attackCooldownTicksFor, speedScaledSeconds } from '../stats';
import type { AbilityDef } from './schema';

/**
 * A fixed phase's ticks: its seconds on the cadence's curve
 * (`speedScaledSeconds`) when it `scalesWithSpeed`, a flat conversion
 * otherwise. Callers handle `'fill'` first.
 */
function fixedPhaseTicks(seconds: number, scalesWithSpeed: boolean, speed: number): number {
  return secondsToTicks(scalesWithSpeed ? speedScaledSeconds(seconds, speed) : seconds);
}

/**
 * The cooldown before the def proposes again, in ticks, and the whole busy
 * window of a def with a `'fill'` phase. A speed-scaled def rides the strikes'
 * cadence curve; a flat one converts its seconds, floored at 1 tick.
 */
export function resolveCadenceTicks(def: AbilityDef, speed: number): number {
  return def.speedScaled
    ? attackCooldownTicksFor(def.cooldownSeconds, speed)
    : Math.max(1, secondsToTicks(def.cooldownSeconds));
}

/**
 * The phase timeline in ticks for a caster's `speed`, in the def's order, ready
 * for `ActionProposal.phases`. A fixed phase converts its seconds (0 s is a
 * 0-tick boundary, as a strike's `impact` is); the `'fill'` phase, when there
 * is one, takes what the cadence has left after the fixed phases, at least 0.
 * The fixed phases are clamped in order against the cadence, so they never
 * overrun it: where they would, the earlier phases keep their length and a
 * later one is cut.
 */
export function resolvePhases(def: AbilityDef, speed: number): ActionPhase[] {
  const hasFill = def.timeline.some((p) => p.seconds === 'fill');
  if (!hasFill) {
    // No elastic phase: each phase converts on its own, and the busy window is
    // their sum, apart from the cooldown (the dash).
    return def.timeline.map((p) => ({
      phase: p.phase,
      ticks: p.seconds === 'fill' ? 0 : fixedPhaseTicks(p.seconds, p.scalesWithSpeed, speed),
    }));
  }

  const cadenceTicks = resolveCadenceTicks(def, speed);
  // First pass: clamp the fixed phases, in order, against the cadence. A
  // `scalesWithSpeed` phase shrinks with the cadence, so the `'fill'` phase
  // keeps a steady share instead of being squeezed toward 0.
  let remaining = cadenceTicks;
  const fixedTicks = new Map<number, number>();
  def.timeline.forEach((p, i) => {
    if (p.seconds === 'fill') return;
    const ticks = Math.min(fixedPhaseTicks(p.seconds, p.scalesWithSpeed, speed), remaining);
    fixedTicks.set(i, ticks);
    remaining -= ticks;
  });
  // What is left fills the elastic phase (at least 0).
  return def.timeline.map((p, i) => ({
    phase: p.phase,
    ticks: p.seconds === 'fill' ? remaining : (fixedTicks.get(i) ?? 0),
  }));
}
