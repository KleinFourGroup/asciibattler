/**
 * The empower's rules, pure so they are tested without a `Run`: at the
 * pre-turn gate the player picks one drawn card, and its roster slot gains
 * the granting source's buff for the rest of the encounter. Grants are queued
 * per source as the redraw's are (`redraw.ts`). `Run.handleEmpowerUnit` is
 * the caller.
 */

import type { EmpowerConfig } from '../config/empower';
import type { StatKey, StatusEffect } from '../sim/statusEffects';

/** One empower grant's live state, as the validator reads it: a `TurnGrant`
 *  whose effect is an empower, flattened. */
interface EmpowerGrantState {
  /** Actions consumed from this grant (`TurnGrant.used`). */
  used: number;
  /** Actions this grant carries (`effect.budget`). */
  budget: number;
}

/** What the fuzz empower policy reads of one grant: the actions left on it.
 *  The harness and the rollout build it from the grant's view. */
export interface EmpowerAvailability {
  empowersRemaining: number;
}

/**
 * One badged buff on one hand card, as the pre-turn payloads carry it
 * (`empowerStacks`, parallel to `hand`: a list per card, an entry per buff in
 * the slot's encounter store whose key is an owned empower daemon's or any
 * packet's; every shipped buff merges by key, so that is one entry a key).
 * Each key is
 * its own entry so the card can show each buff with its own hover; `mods`
 * rides along so the UI spells each one without reaching into the store.
 * Entries are copies (`Run.empowerStacks` clones them), so a payload kept
 * after the store merges in place does not change with it.
 */
export interface EmpowerStackView {
  readonly key: string;
  readonly magnitude: number;
  readonly mods: StatusEffect['mods'];
}

/**
 * Validate one empower request against one grant: `handIndex` is a position
 * in the current hand, not a roster index, as the redraw's selection is.
 * Returns a reject reason, or `null` when the empower may proceed; a rejected
 * request consumes no budget. Which grant may be used (strict mode allows
 * only the active one) is the caller's check.
 */
export function empowerRejection(
  handIndex: number,
  handLength: number,
  grant: EmpowerGrantState,
): string | null {
  if (grant.used >= grant.budget) return 'no empowers left on this grant';
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= handLength) {
    return 'hand position out of range';
  }
  return null;
}

/**
 * The `StatusEffect` one empower action applies, from the granting source's
 * buff, which rides the grant. Magnitude 1, one stack an action, with the
 * strength in the buff's `mods`; lifetime `endOfTurn`, the shape
 * `Run.addEncounterEffect` takes, since the encounter store re-seeds the
 * effect onto the fielded unit every turn and that is what makes it last the
 * encounter. The mods are copied, so the store, which merges in place, never
 * aliases the authored buff.
 */
export function empowerEffect(buff: EmpowerConfig['buff']): StatusEffect {
  const mods: StatusEffect['mods'] = {};
  for (const stat of Object.keys(buff.mods) as StatKey[]) {
    mods[stat] = { ...buff.mods[stat]! };
  }
  return {
    key: buff.key,
    magnitude: 1,
    mods,
    lifetime: { kind: 'endOfTurn' },
    merge: buff.merge,
  };
}
