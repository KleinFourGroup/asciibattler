import type { Action } from '../Action';
import type { ActionProposal } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const WAIT_ACTION_ID = 'wait';

/**
 * §44b — the first-class WAIT: a unit's deliberate "I choose to hold this cell
 * this tick", offered to the selector instead of a bare `null` abstain. The
 * behaviors' deliberate-hold sites (the firing-band / heal-range holds — see
 * `moveDecision.ts`'s `wait` kind) propose it; helpless abstains (frozen /
 * boxed / no_goal) stay `null`, which now means only "nothing to propose".
 *
 * INSTANTANEOUS BY CONSTRUCTION — the load-bearing §44b decision. A wait
 * carries an EMPTY phase timeline and no `applyEffect`, so `World`'s
 * instantaneous-action rule resolves it entirely within the tick it wins:
 * `start()` emits `unit:waited` and touches nothing; the unit never enters the
 * in-flight machinery (`activeAction`) and re-decides fresh next poll. That is
 * what keeps a waiting unit's world bytes IDENTICAL to the old abstaining
 * unit's — no WorldSnapshot bump, no serialized "did nothing" state. If a
 * future consumer wants a COMMITTED multi-tick wait, that's a deliberate
 * schema event: audit the WorldSnapshot surface first (an in-flight wait is a
 * bump), don't just hand this class a nonzero timeline.
 *
 * Deliberately NOT in the action registry: a wait can never be mid-flight at
 * a snapshot, so `'wait'` reaching `createAction` means the invariant above
 * broke — the `abilityDef('wait')` fallback throws, and the corruption is loud
 * instead of silently decoded.
 */
export class WaitAction implements Action {
  readonly id = WAIT_ACTION_ID;

  start(unit: Unit, world: World): void {
    world.emit('unit:waited', { unitId: unit.id });
  }

  /** Present to satisfy `Action`; unreachable — a wait is never serialized. */
  toData(): unknown {
    return {};
  }
}

/**
 * The shared wait proposal. Score 1 — the move tier — so any ready ability
 * (attacks / heals at 10, the panic-retreat at 5) still outranks holding by
 * construction; the wait only wins when holding genuinely is the best thing
 * on offer. Cooldown 0: a unit may wait indefinitely, one deliberate tick at
 * a time. A single frozen instance (not a per-call allocation) because a wait
 * captures no parameters — every field is readonly and the selector never
 * mutates proposals.
 */
const WAIT_PROPOSAL: ActionProposal = Object.freeze({
  action: new WaitAction(),
  score: 1,
  cooldown: 0,
  phases: [],
});

export function waitProposal(): ActionProposal {
  return WAIT_PROPOSAL;
}
