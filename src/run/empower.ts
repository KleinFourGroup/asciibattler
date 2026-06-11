/**
 * K4 — the pure empower rules: validation + availability math for the
 * pre-turn empower (select ONE drawn card → its roster slot gains the
 * configured buff for the rest of the encounter).
 *
 * Pulled out of `Run` so the config modes are provable in isolation (the
 * config is a parameter, not the `EMPOWER` singleton): the shipped
 * "one empower per turn" default and the raised-`empowersPerTurn` mode a
 * Phase-L daemon would grant. `Run.handleEmpowerUnit` is a thin caller at
 * the `EMPOWER` defaults. Mirrors `redraw.ts` (K3) shape-for-shape.
 */

import type { EmpowerConfig } from '../config/empower';
import type { StatKey, StatusEffect } from '../sim/statusEffects';

/** Per-turn empower bookkeeping, reset at every turn start (`startNextTurn`).
 *  Round-trips in the Run save (v15) — a save taken at the pre-turn gate
 *  after an empower must not refresh the budget on load. */
export interface EmpowerTurnState {
  /** Empower ACTIONS taken this turn (vs `cfg.empowersPerTurn`). */
  empowersUsed: number;
}

/** What the pre-turn screen needs to render the control. Disabled config
 *  reads as 0. */
export interface EmpowerAvailability {
  empowersRemaining: number;
}

export function empowerAvailability(
  state: EmpowerTurnState,
  cfg: EmpowerConfig,
): EmpowerAvailability {
  if (!cfg.enabled) return { empowersRemaining: 0 };
  return {
    empowersRemaining: Math.max(0, cfg.empowersPerTurn - state.empowersUsed),
  };
}

/**
 * Validate one empower request: `handIndex` is a position into the current
 * hand (NOT a roster index — same "which card the player clicked" contract
 * as the redraw selection). Returns a reject reason, or `null` when the
 * empower may proceed. A rejected request consumes NO budget (the caller
 * returns without mutating).
 */
export function empowerRejection(
  handIndex: number,
  handLength: number,
  state: EmpowerTurnState,
  cfg: EmpowerConfig,
): string | null {
  if (!cfg.enabled) return 'empower disabled';
  if (empowerAvailability(state, cfg).empowersRemaining <= 0) {
    return 'no empowers left this turn';
  }
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= handLength) {
    return 'hand position out of range';
  }
  return null;
}

/**
 * Build the `StatusEffect` one empower action applies, from the config buff.
 * Magnitude is always 1 (one action = one stack; stack strength lives in the
 * config `mods`) and the lifetime is `endOfTurn` — the shape
 * `Run.addEncounterEffect` expects (the encounter store re-seeds it onto the
 * fielded unit every turn, which is what makes it encounter-lived). Mods are
 * deep-copied so the live store never aliases the config singleton (merging
 * mutates instances in place).
 */
export function empowerEffect(cfg: EmpowerConfig): StatusEffect {
  const mods: StatusEffect['mods'] = {};
  for (const stat of Object.keys(cfg.buff.mods) as StatKey[]) {
    mods[stat] = { ...cfg.buff.mods[stat]! };
  }
  return {
    key: cfg.buff.key,
    magnitude: 1,
    mods,
    lifetime: { kind: 'endOfTurn' },
    merge: cfg.buff.merge,
  };
}
