/**
 * Phase 27 — the bridge between a config `StatusDef` (the template) and a
 * runtime K1 `StatusEffect` (the live instance on `Unit.effects`).
 *
 * Kept separate from `statusSchema.ts` (pure schema) and `statusEffects.ts`
 * (pure K1 model) so neither has to import the other: this module depends on
 * both (+ the seconds→ticks conversion) and is the single place that knows how
 * to turn a def into an effect.
 */

import { secondsToTicks } from '../../config';
import type { StatusEffect, MergePolicy } from '../statusEffects';
import type { StatusDef, StatusMerge } from './statusSchema';

/**
 * Map the `StatusDef` merge vocabulary (the brief's names) onto K1's
 * `MergePolicy`. `refresh` → `replace` (reset duration, replace magnitude with
 * the base); `add` → `add` (stack); `instances` → `independent` (separate
 * copies); `ignore` → `ignore` (no-op if present). The reserved `instances` /
 * `ignore` have no §27 content consumer but map cleanly so the union is closed.
 */
export function statusMergeToPolicy(merge: StatusMerge): MergePolicy {
  switch (merge) {
    case 'refresh':
      return 'replace';
    case 'add':
      return 'add';
    case 'instances':
      return 'independent';
    case 'ignore':
      return 'ignore';
  }
}

/**
 * Build a runtime `StatusEffect` from a `StatusDef` applied at `atTick`. The
 * periodic op / interval / duration are NOT stored on the effect — they're
 * def-resolved by `key` (= the def id) at tick time; the only periodic runtime
 * state is `nextTickAt` (the per-unit cursor, first tick one interval AFTER
 * apply, so the applying hit doesn't double-dip). `mods` is empty in 27 (the
 * `statMods` authoring axis is deferred — see `statusSchema.ts`). Tick/duration
 * conversions floor at 1 tick so a sub-tick interval still advances.
 */
export function buildStatusEffect(
  def: StatusDef,
  atTick: number,
  magnitude: number,
  sourceUnitId: number | null,
): StatusEffect {
  const durationTicks = Math.max(1, secondsToTicks(def.durationSeconds));
  const effect: StatusEffect = {
    key: def.id,
    magnitude,
    mods: {},
    lifetime: { kind: 'ticks', expiresAtTick: atTick + durationTicks },
    merge: statusMergeToPolicy(def.merge),
    sourceUnitId,
  };
  if (def.periodic) {
    const everyTicks = Math.max(1, secondsToTicks(def.periodic.everySeconds));
    effect.nextTickAt = atTick + everyTicks;
  }
  return effect;
}
