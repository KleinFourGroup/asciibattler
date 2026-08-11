/**
 * §76g — the pure derived-delta builder for the promotion screen. The raw
 * `+N` stat chips answer "what grew"; these lines answer "what those points
 * actually BOUGHT": one `before → after` row per derived value that visibly
 * changed (Max HP, dodge, move cadence, per-ability output). Extracted as a
 * pure function (the `abilityDetailParts` precedent) so the wording is
 * headless-testable; the DOM stays eyeball-only in PromotionScreen.
 *
 * Only DISPLAY-grade changes emit a line: values are formatted first and
 * compared as strings, so a stat gain that tick-rounding or a floor/cap
 * swallows (a mobility bump inside the same tick, a crit already at cap)
 * produces no row — the block never claims a change the player can't feel.
 *
 * Per-ability rows reuse `abilityDetailParts` verbatim and diff the part
 * arrays positionally (the parts' STRUCTURE depends only on the def, never
 * on stats, so old/new arrays always align). Stat-independent parts
 * (`rng N`, riders, aura lines) compare equal and drop out for free, and
 * any future op kind the detail builder learns is covered here with no new
 * code. The speed-scaled cadence (abilityRow's separate column) is diffed
 * alongside.
 *
 * Reference conventions (matching the card the block sits on): hit% runs vs
 * a neutral 0-evasion target (the `abilityDetailParts` convention); dodge%
 * mirrors it as a base-`REF_ACCURACY` 0-precision reference attacker (the
 * archetype editor's REF_ACCURACY convention, fixed instead of dialable).
 */

import type { Archetype, UnitStats } from '../sim/Unit';
import { abilityIdsForArchetype } from '../sim/archetypes';
import { abilityDef } from '../config/abilities';
import { abilityDetailParts } from './abilityDetail';
import { attackCooldownTicksFor, deriveStats, hitChanceFor } from '../sim/stats';
import { ticksToSeconds } from '../config';

/** The generic reference attacker's base accuracy for the dodge line (the
 *  archetype editor's convention — accuracy is per-weapon, so "dodge" needs
 *  SOME attacker to be defined against). */
const REF_ACCURACY = 0.6;

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function secs(ticks: number): string {
  return `${ticksToSeconds(ticks).toFixed(2)}s`;
}

/** Push `label before → after` iff the formatted values differ. */
function pushChanged(lines: string[], label: string, before: string, after: string): void {
  if (before !== after) lines.push(`${label} ${before} → ${after}`);
}

export function promotionDeltaParts(
  oldStats: UnitStats,
  newStats: UnitStats,
  archetype: Archetype,
): string[] {
  const lines: string[] = [];

  // Derived block deltas. `deriveStats`' attackRange param is ability-derived
  // and level-independent — pass 0; only maxHp/moveCooldownTicks are read.
  const oldDerived = deriveStats(oldStats, 0);
  const newDerived = deriveStats(newStats, 0);
  pushChanged(lines, 'Max HP', String(oldDerived.maxHp), String(newDerived.maxHp));
  pushChanged(
    lines,
    'Dodge',
    pct(1 - hitChanceFor(REF_ACCURACY, 0, oldStats.evasion)),
    pct(1 - hitChanceFor(REF_ACCURACY, 0, newStats.evasion)),
  );
  pushChanged(
    lines,
    'Move cadence',
    secs(oldDerived.moveCooldownTicks),
    secs(newDerived.moveCooldownTicks),
  );

  for (const id of abilityIdsForArchetype(archetype)) {
    const def = abilityDef(id);
    const before = abilityDetailParts(id, archetype, oldStats);
    const after = abilityDetailParts(id, archetype, newStats);
    const changed: string[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) changed.push(`${before[i]} → ${after[i]}`);
    }
    if (def.speedScaled) {
      const b = secs(attackCooldownTicksFor(def.cooldownSeconds, oldStats.speed));
      const a = secs(attackCooldownTicksFor(def.cooldownSeconds, newStats.speed));
      if (b !== a) changed.push(`cadence ${b} → ${a}`);
    }
    if (changed.length > 0) lines.push(`${def.name}: ${changed.join(' · ')}`);
  }

  return lines;
}
