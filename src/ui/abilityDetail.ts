/**
 * 34b — the pure detail-string builder for a UnitCard ability row. Extracted out
 * of `UnitCard.abilityRow` so the "what does this ability DO" readout is
 * headless-testable (no DOM): it maps an `AbilityDef`'s effect ops to the terse
 * ` · `-joined parts shown under the ability name. `abilityRow` owns the DOM
 * (the name/cadence columns + the styled AoE tag); this owns the wording.
 *
 * It must cover every op a §29 archetype fields — `applyStatus` (afflicters),
 * `summon` (Shaman), and `chain` (Stormcaller, whose damage is NESTED in the
 * chain's inner ops) — none of which the original heal/damage-only logic built a
 * detail for, leaving those rows blank (and mislabelling the self-anchored summon
 * as a "dash").
 */

import type { Archetype, UnitStats } from '../sim/Unit';
import { abilityDef, damageOpOf, healOpOf, firstOpOf } from '../config/abilities';
import { damageStatFor } from '../sim/stats';

export function abilityDetailParts(id: string, archetype: Archetype, stats: UnitStats): string[] {
  const def = abilityDef(id);
  const parts: string[] = [];

  const healOp = healOpOf(id);
  const damageOp = damageOpOf(id);
  const chainOp = firstOpOf(id, 'chain');
  const summonOp = firstOpOf(id, 'summon');
  const statusOp = firstOpOf(id, 'applyStatus');

  if (healOp) {
    parts.push(`${healOp.might + stats.magic} heal`, `rng ${def.rangeCells}`);
  } else if (damageOp) {
    parts.push(`${damageOp.might + damageStatFor(archetype, stats)} dmg`, `rng ${def.rangeCells}`);
    // I6 — surface the per-weapon profile: base hit chance for an evadable
    // strike, base crit for a critable one (terse percentages, e.g. "60% hit").
    if (damageOp.evadable) parts.push(`${Math.round(damageOp.accuracy * 100)}% hit`);
    if (damageOp.critable) parts.push(`${Math.round(damageOp.critBase * 100)}% crit`);
  } else if (chainOp) {
    // 29c — the bolt's damage is NESTED in the chain's inner ops (the chain arcs
    // and applies them per hop), so `damageOpOf` finds none; pull the inner
    // damage out and surface it alongside the jump count.
    const inner = chainOp.ops.find((o) => o.kind === 'damage');
    if (inner && inner.kind === 'damage') {
      parts.push(`${inner.might + damageStatFor(archetype, stats)} dmg`);
    }
    parts.push(`chains ${chainOp.maxJumps}`, `rng ${def.rangeCells}`);
  } else if (summonOp) {
    // 29d — a summoner (Shaman `raise_dead`): show what it raises. This also
    // corrects the old `self`-target branch, which mislabelled the self-anchored
    // summon as a "dash".
    const { count, archetype: minion } = summonOp.summon;
    parts.push(count > 1 ? `summons ${count}×${minion}` : `summons ${minion}`, `rng ${def.rangeCells}`);
  } else if (statusOp) {
    // 29a-b — a PURE afflicter (Warlock `hex`, Banshee `wail`): no damage, just
    // the status it lays. (Damage afflicters fall through to the rider below.)
    parts.push(`applies ${statusOp.statusId}`, `rng ${def.rangeCells}`);
  } else if (def.target.kind === 'self') {
    // N1 — a pure-reposition leap (the dash): no damage/heal profile, just the
    // leap distance (its recharge shows in the cadence column below).
    parts.push(`dash ${def.rangeCells}`);
  }

  // 29a — a damage afflicter (cleaver/vial/ice_storm/light_ray) lays a status ON
  // TOP of its hit; append the rider so it isn't invisible.
  if (statusOp && (damageOp || chainOp)) parts.push(`+${statusOp.statusId}`);

  return parts;
}
