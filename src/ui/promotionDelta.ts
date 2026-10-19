/**
 * The promotion card's derived lines. The `+N` stat chips say what grew;
 * these say what the points bought: one `before → after` row per derived
 * value that visibly changed (Max HP, dodge, move cadence, each ability's
 * output). Pure, so the wording is tested headless; the DOM is
 * PromotionScreen's.
 *
 * Only a change the display shows emits a line: values are formatted first
 * and compared as strings, so a gain that tick rounding or a floor or cap
 * swallows (a mobility point inside the same tick, a crit already at its
 * cap) makes no row, and the block never claims a change the player can't
 * feel.
 *
 * Each ability's row reuses `abilityDetailParts` and diffs the parts by
 * position: their structure depends only on the def, never on stats, so
 * the old and new arrays align. Parts that don't depend on stats (`reach
 * N`, riders, auras) compare equal and drop out, and an op kind the detail
 * builder learns needs no code here. The speed-scaled cadence, which the
 * card shows in its own column, is diffed beside them.
 *
 * The references match the card the block sits on: hit runs against a
 * target with 0 evasion (`abilityDetailParts`'s), and dodge is against an
 * attacker of base accuracy `REF_ACCURACY` and 0 precision (the archetype
 * editor's reference attacker, whose precision there is a dial).
 */

import type { Archetype, UnitStats } from '../sim/Unit';
import { abilityIdsForArchetype } from '../sim/archetypes';
import { abilityDef } from '../config/abilities';
import { t } from '../i18n/ui';
import { abilityDetailParts } from './abilityDetail';
import { attackCooldownTicksFor, deriveStats, hitChanceFor } from '../sim/stats';
import { ticksToSeconds } from '../config';

/** The reference attacker's base accuracy for the dodge line, the archetype
 *  editor's: accuracy is per weapon, so dodge needs some attacker to be
 *  defined against. */
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

  // The derived block. `deriveStats`' `attackRange` comes from the abilities
  // and no level moves it, so 0 is passed; only `maxHp` and
  // `moveCooldownTicks` are read.
  const oldDerived = deriveStats(oldStats, 0);
  const newDerived = deriveStats(newStats, 0);
  pushChanged(
    lines,
    t('promotion.delta.maxHp'),
    String(oldDerived.maxHp),
    String(newDerived.maxHp),
  );
  pushChanged(
    lines,
    t('promotion.delta.dodge'),
    pct(1 - hitChanceFor(REF_ACCURACY, 0, oldStats.evasion)),
    pct(1 - hitChanceFor(REF_ACCURACY, 0, newStats.evasion)),
  );
  pushChanged(
    lines,
    t('promotion.delta.moveCadence'),
    secs(oldDerived.moveCooldownTicks),
    secs(newDerived.moveCooldownTicks),
  );

  for (const id of abilityIdsForArchetype(archetype)) {
    const def = abilityDef(id);
    const before = abilityDetailParts(id, oldStats);
    const after = abilityDetailParts(id, newStats);
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
