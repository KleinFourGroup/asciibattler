/**
 * Turns a config `StatusDef` (the template, `statusSchema.ts`) into a runtime
 * `StatusEffect` (the live instance on `Unit.effects`, `statusEffects.ts`).
 * It is its own module so that neither of those imports the other; this is the
 * one place that knows how a def becomes an effect.
 */

import { secondsToTicks } from '../../config';
import type { StatusEffect, MergePolicy, StatKey, StatMod } from '../statusEffects';
import type { StatusDef, StatusMerge } from './statusSchema';

/**
 * A def's merge word as the effect's `MergePolicy` (whose doc says what each
 * does): `refresh` → `replace`, `add` → `add`, `instances` → `independent`,
 * `ignore` → `ignore`. No shipped status uses `instances` or `ignore`; they map
 * so the union is closed.
 */
function statusMergeToPolicy(merge: StatusMerge): MergePolicy {
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
 * A runtime `StatusEffect` for `def` applied at `atTick`. The periodic op,
 * its interval and the duration are not stored on the effect: they are read
 * off the def by `key` (the def's id) when it ticks. The one periodic state is
 * `nextTickAt`, first set one interval after the apply, so the hit that
 * applied the status is not followed by a tick on the same tick. `mods` copies
 * the def's `statMods` (per unit of magnitude), one copy per instance, since a
 * merge mutates mods in place. The duration and the interval floor at 1 tick,
 * so a sub-tick interval still advances.
 */
export function buildStatusEffect(
  def: StatusDef,
  atTick: number,
  magnitude: number,
  sourceUnitId: number | null,
  // The `applyStatus` op's duration for this application, in seconds; the
  // def's own duration when absent.
  durationSecondsOverride?: number,
): StatusEffect {
  const durationTicks = Math.max(
    1,
    secondsToTicks(durationSecondsOverride ?? def.durationSeconds),
  );
  // Zod gives an absent optional as an explicit `undefined`; copy only the
  // fields that are set, so each `StatMod` is exact, as `normalizeMods` in
  // `src/config/empower.ts` does.
  const mods: Partial<Record<StatKey, StatMod>> = {};
  if (def.statMods) {
    for (const [stat, mod] of Object.entries(def.statMods)) {
      const out: StatMod = {};
      if (mod.add !== undefined) out.add = mod.add;
      if (mod.mul !== undefined) out.mul = mod.mul;
      mods[stat as StatKey] = out;
    }
  }
  const effect: StatusEffect = {
    key: def.id,
    magnitude,
    mods,
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
