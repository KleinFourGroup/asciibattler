/**
 * The detail line of a unit card's ability row, pure so that what an
 * ability does is tested headless: it maps an `AbilityDef`'s effect ops to
 * the terse ` · `-joined parts shown under the ability's name.
 * `UnitCard.abilityRow` owns the DOM (the name and cadence columns, the
 * styled AoE tag); this owns the wording.
 *
 * It must cover every op an archetype's ability fields, `applyStatus`,
 * `summon` and `chain` (whose damage is nested in the chain's inner ops)
 * among them, or that ability's row is blank.
 */

import type { UnitStats } from '../sim/Unit';
import type { AbilityDef, EffectOp } from '../sim/effects/schema';
import { abilityDef } from '../config/abilities';
import { critChanceFor } from '../sim/stats';
import { resolveDamageScalars, resolveHealAmount } from '../sim/effects/resolveScalars';

export function abilityDetailParts(id: string, stats: UnitStats): string[] {
  return abilityDetailPartsForDef(abilityDef(id), stats);
}

/** The op of `kind` from a def's effects, or undefined. The builder takes
 *  the def rather than an id, so a def outside the catalog (a test's
 *  synthetic one) is coverable headless. */
function opOf<K extends EffectOp['kind']>(
  def: AbilityDef,
  kind: K,
): Extract<EffectOp, { kind: K }> | undefined {
  const entry = def.effects.find((e) => e.op.kind === kind);
  return entry?.op as Extract<EffectOp, { kind: K }> | undefined;
}

export function abilityDetailPartsForDef(def: AbilityDef, stats: UnitStats): string[] {
  const parts: string[] = [];

  const healOp = opOf(def, 'heal');
  const damageOp = opOf(def, 'damage');
  const chainOp = opOf(def, 'chain');
  const summonOp = opOf(def, 'summon');
  const statusOp = opOf(def, 'applyStatus');

  if (healOp) {
    parts.push(`${resolveHealAmount(healOp, stats)} heal`, `reach ${def.rangeCells}`);
  } else if (damageOp) {
    parts.push(`${resolveDamageScalars(damageOp, stats).baseDamage} dmg`, `reach ${def.rangeCells}`);
    // The weapon's crit, derived as the damage number is (the op's base and
    // the unit's stat): `critChanceFor` with its luck, which is exact, having
    // no target term, and keeps the sim's cap.
    pushCrit(parts, damageOp, stats);
  } else if (chainOp) {
    // A chain's damage is nested in its inner ops (the chain arcs and
    // applies them per hop), so `opOf(def, 'damage')` finds none; the inner
    // damage is read out and shown with the jump count.
    const inner = chainOp.ops.find((o) => o.kind === 'damage');
    if (inner && inner.kind === 'damage') {
      parts.push(`${resolveDamageScalars(inner, stats).baseDamage} dmg`);
      // The inner strike's crit, derived the same way (gated on its flag).
      pushCrit(parts, inner, stats);
    }
    parts.push(`chains ${chainOp.maxJumps}`, `reach ${def.rangeCells}`);
  } else if (summonOp) {
    // A summoner (the Shaman's `raise_dead`): what it raises. It targets
    // `self`, so it must come before the dash branch.
    const { count, archetype: minion } = summonOp.summon;
    parts.push(count > 1 ? `summons ${count}×${minion}` : `summons ${minion}`, `reach ${def.rangeCells}`);
  } else if (statusOp) {
    // A pure afflicter (the Warlock's `hex`, the Banshee's `wail`): no
    // damage, only the status it lays. A damage afflicter takes the rider
    // below instead.
    parts.push(`applies ${statusOp.statusId}`, `reach ${def.rangeCells}`);
  } else if (def.aura) {
    // A pure aura (no ops; the schema makes it target `self`): the status
    // it radiates and the aura's own radius, not `rangeCells`, which is the
    // engagement reach. It must come before the dash branch, which would
    // otherwise label it a dash.
    parts.push(`aura ${def.aura.statusId}`, `reach ${def.aura.radius}`);
  } else if (def.target.kind === 'self') {
    // A pure reposition (the dash): no damage or heal, only the leap's
    // distance (its recharge shows in the card's cadence column).
    parts.push(`dash ${def.rangeCells}`);
  }

  // A damage afflicter lays a status on top of its hit; the rider shows it.
  if (statusOp && (damageOp || chainOp)) parts.push(`+${statusOp.statusId}`);

  // An ability with ops that also radiates an aura: the aura is a rider, so
  // the passive shows on the card.
  if (def.aura && (healOp || damageOp || chainOp || summonOp || statusOp)) {
    parts.push(`+aura ${def.aura.statusId}`);
  }

  return parts;
}

/** The derived crit chance of one damage op. */
function pushCrit(parts: string[], op: { critable: boolean; critBase: number }, stats: UnitStats): void {
  if (op.critable) {
    parts.push(`${Math.round(critChanceFor(op.critBase, stats.luck) * 100)}% crit`);
  }
}
