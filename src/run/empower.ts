/**
 * K4 — the pure empower rules: validation + the effect builder for the
 * pre-turn empower (select ONE drawn card → its roster slot gains the
 * configured buff for the rest of the encounter).
 *
 * Pulled out of `Run` so the modes are provable in isolation. 49d re-modeled
 * the input from the old config + counter to ONE GRANT QUEUE ENTRY
 * (`EmpowerGrantState` — a `TurnGrant` empower effect flattened with its
 * `used` count), mirroring `redraw.ts` shape-for-shape. Existence is
 * availability (no queue entry = nothing to validate), so the K4-era
 * `enabled` gate is gone. `Run.handleEmpowerUnit` is a thin caller.
 */

import type { EmpowerConfig } from '../config/empower';
import type { StatKey, StatusEffect } from '../sim/statusEffects';

/** 49d — one empower grant's live state, as the validator reads it (a
 *  `TurnGrant` with `effect.kind === 'empower'`, flattened). */
export interface EmpowerGrantState {
  /** Actions consumed from this grant (`TurnGrant.used`). */
  used: number;
  /** Actions this grant carries (`effect.budget`). */
  budget: number;
}

/** What an empower control renders: actions left on this grant. */
export interface EmpowerAvailability {
  empowersRemaining: number;
}

export function empowerAvailability(grant: EmpowerGrantState): EmpowerAvailability {
  return { empowersRemaining: Math.max(0, grant.budget - grant.used) };
}

/**
 * Validate one empower request against ONE grant: `handIndex` is a position
 * into the current hand (NOT a roster index — same "which card the player
 * clicked" contract as the redraw selection). Returns a reject reason, or
 * `null` when the empower may proceed. A rejected request consumes NO budget
 * (the caller returns without mutating). Queue-order legality (strict mode's
 * active-grant rule) is the CALLER's check — this validates the grant's own
 * budget only.
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
 * Build the `StatusEffect` one empower action applies, from the granting
 * source's buff (49d: the buff rides the queue entry — the old
 * `EmpowerConfig` shim is gone). Magnitude is always 1 (one action = one
 * stack; stack strength lives in the buff `mods`) and the lifetime is
 * `endOfTurn` — the shape `Run.addEncounterEffect` expects (the encounter
 * store re-seeds it onto the fielded unit every turn, which is what makes it
 * encounter-lived). Mods are deep-copied so the live store never aliases the
 * authored buff (merging mutates instances in place).
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
