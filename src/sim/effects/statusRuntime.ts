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
import type { StatusEffect, MergePolicy, StatKey, StatMod } from '../statusEffects';
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
 * apply, so the applying hit doesn't double-dip). `mods` copies the def's
 * `statMods` (the 47f authoring axis — per one unit of magnitude, the K1
 * contract; each instance gets its OWN copy since merging mutates mods in
 * place). Tick/duration conversions floor at 1 tick so a sub-tick interval
 * still advances.
 */
export function buildStatusEffect(
  def: StatusDef,
  atTick: number,
  magnitude: number,
  sourceUnitId: number | null,
  // 29 — the `applyStatus` op's optional per-application duration override (in
  // seconds); falls back to the def's base duration when absent.
  durationSecondsOverride?: number,
): StatusEffect {
  const durationTicks = Math.max(
    1,
    secondsToTicks(durationSecondsOverride ?? def.durationSeconds),
  );
  // 47f — normalize zod's explicit-`undefined` optionals into exact `StatMod`
  // objects (the `config/empower.ts` `normalizeMods` discipline), copying per
  // instance.
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
