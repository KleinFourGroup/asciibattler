/**
 * Phase Y1 — the seconds→ticks timeline conversion for an `AbilityDef`.
 *
 * Definitions are authored in SECONDS; the sim executes in TICKS. This module is
 * the pure conversion that reproduces the existing per-ability proposal builders'
 * phase timelines byte-for-byte (the Phase Y3/Y4 determinism oracle then proves
 * the equivalence end-to-end). No behavior — just `(def, speed) → ticks`.
 *
 * The subtlety the brief's flat `Record<Phase, number>` sketch missed: a strike's
 * busy window is SPEED-SCALED (`attackCooldownTicksFor`), with fixed sub-phases
 * (the gambit's windup, a projectile's travel) carved OUT of it and one ELASTIC
 * `'fill'` phase absorbing the remainder. So the timeline can't be a flat record
 * of authored seconds — it needs the `'fill'` sentinel. The dash is the outlier:
 * a FLAT cooldown (`speedScaled:false`) decoupled from its short motion window
 * (no `'fill'` phase → busy window = Σ fixed phases, independent of cooldown).
 *
 * Phase Yb adds a third option per phase: a FIXED phase may set `scalesWithSpeed`
 * to shrink with the caster's `speed` (the same curve the cadence rides) instead
 * of staying constant. This lets a charged spell author a short, snappy windup
 * tell that still tracks the cadence across the full speed range — without it, a
 * constant windup clamps a floor under the cadence and wastes most of the speed
 * headroom. See `fixedPhaseTicks` / `speedScaledSeconds`.
 */

import type { ActionPhase } from '../Action';
import { secondsToTicks } from '../../config';
import { attackCooldownTicksFor, speedScaledSeconds } from '../stats';
import type { AbilityDef } from './schema';

/**
 * Phase Yb — a fixed (numeric) phase's duration in ticks. When the phase opts in
 * via `scalesWithSpeed`, its seconds first ride the cadence curve
 * (`speedScaledSeconds`) so it shrinks with the caster's `speed`; otherwise it's a
 * flat conversion. The `'fill'` sentinel never reaches here — callers branch on it
 * first.
 */
function fixedPhaseTicks(seconds: number, scalesWithSpeed: boolean, speed: number): number {
  return secondsToTicks(scalesWithSpeed ? speedScaledSeconds(seconds, speed) : seconds);
}

/**
 * The re-proposal cooldown in ticks (also the total busy window for any def with
 * a `'fill'` phase). Speed-scaled attacks ride the same cadence curve the strikes
 * use; flat utilities convert their seconds and floor at 1 (mirrors `DashAbility`).
 */
export function resolveCadenceTicks(def: AbilityDef, speed: number): number {
  return def.speedScaled
    ? attackCooldownTicksFor(def.cooldownSeconds, speed)
    : Math.max(1, secondsToTicks(def.cooldownSeconds));
}

/**
 * The phase timeline in ticks for a given caster `speed`. Fixed phases convert
 * via `secondsToTicks` (0 s → a 0-tick boundary, e.g. a strike's `impact`); the
 * single `'fill'` phase, when present, takes `cadenceTicks − Σ(fixed)` (clamped
 * ≥ 0). Fixed phases are clamped greedily so they never overrun the cadence
 * window — reproducing each builder's `min(carve, duration)` exactly (only one
 * non-zero fixed phase ever sits alongside a `'fill'`, so the greedy clamp
 * collapses to that `min`).
 *
 * Returns `ActionPhase[]` in the def's authored order, ready to drop into an
 * `ActionProposal.phases`.
 */
export function resolvePhases(def: AbilityDef, speed: number): ActionPhase[] {
  const hasFill = def.timeline.some((p) => p.seconds === 'fill');
  if (!hasFill) {
    // No elastic phase: every phase is a fixed conversion; the busy window is
    // their sum, decoupled from the cadence cooldown (the dash).
    return def.timeline.map((p) => ({
      phase: p.phase,
      ticks: p.seconds === 'fill' ? 0 : fixedPhaseTicks(p.seconds, p.scalesWithSpeed, speed),
    }));
  }

  const cadenceTicks = resolveCadenceTicks(def, speed);
  // First pass: clamp the fixed phases greedily against the cadence budget. A
  // `scalesWithSpeed` phase (Yb) shrinks alongside the cadence, so the elastic
  // `'fill'` phase keeps a stable share instead of being squeezed toward 0.
  let remaining = cadenceTicks;
  const fixedTicks = new Map<number, number>();
  def.timeline.forEach((p, i) => {
    if (p.seconds === 'fill') return;
    const ticks = Math.min(fixedPhaseTicks(p.seconds, p.scalesWithSpeed, speed), remaining);
    fixedTicks.set(i, ticks);
    remaining -= ticks;
  });
  // Whatever is left fills the elastic phase (≥ 0).
  return def.timeline.map((p, i) => ({
    phase: p.phase,
    ticks: p.seconds === 'fill' ? remaining : (fixedTicks.get(i) ?? 0),
  }));
}
