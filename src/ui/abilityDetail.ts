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
import { damageStatFor, hitChanceFor, critChanceFor } from '../sim/stats';

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
    // I6→51f — the per-weapon profile, DERIVED like the damage number is
    // (base + the unit's stat, the §51 sweep call): hit runs the real
    // `hitChanceFor` with this unit's precision against a neutral 0-evasion
    // target (the same convention as damage ignoring the target's defense);
    // crit runs the real `critChanceFor` with this unit's luck — that one is
    // exact (no target term). Both inherit the sim's floors/caps for free.
    pushHitCrit(parts, damageOp, stats);
  } else if (chainOp) {
    // 29c — the bolt's damage is NESTED in the chain's inner ops (the chain arcs
    // and applies them per hop), so `damageOpOf` finds none; pull the inner
    // damage out and surface it alongside the jump count.
    const inner = chainOp.ops.find((o) => o.kind === 'damage');
    if (inner && inner.kind === 'damage') {
      parts.push(`${inner.might + damageStatFor(archetype, stats)} dmg`);
      // 51f — the inner strike carries the same per-weapon profile; derive
      // it identically (flag-gated, so an unmissable bolt adds nothing).
      pushHitCrit(parts, inner, stats);
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

/** 51f — the derived hit/crit readout for one damage op (see the damageOp
 *  branch for the vs-neutral-target convention). */
function pushHitCrit(
  parts: string[],
  op: { evadable: boolean; accuracy: number; critable: boolean; critBase: number },
  stats: UnitStats,
): void {
  if (op.evadable) {
    parts.push(`${Math.round(hitChanceFor(op.accuracy, stats.precision, 0) * 100)}% hit`);
  }
  if (op.critable) {
    parts.push(`${Math.round(critChanceFor(op.critBase, stats.luck) * 100)}% crit`);
  }
}
