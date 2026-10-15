import type { Action } from '../Action';
import type { ActionProposal } from '../Action';
import type { Unit } from '../Unit';
import type { World } from '../World';

export const WAIT_ACTION_ID = 'wait';

/**
 * A deliberate wait: the unit chooses to hold its cell this tick, and offers
 * the selector a wait instead of abstaining with `null`. The behaviours'
 * deliberate holds (in the firing band, in heal range; `moveDecision.ts`'s
 * `wait` kind) propose it; a unit that cannot act (frozen, boxed in, with no
 * goal) still abstains with `null`, which means only "nothing to propose".
 *
 * A wait is instantaneous, and must stay so. It has no phases and no
 * `applyEffect`, so World resolves it within the tick it wins: `start()` emits
 * `unit:waited` and touches nothing, the unit never takes an `activeAction`,
 * and it decides afresh at its next poll. So a waiting unit leaves no state to
 * serialize. A wait that lasts several ticks would be a snapshot change: an
 * action under way is saved, so read the `WorldSnapshot` surface first rather
 * than giving this class a timeline.
 *
 * It is left out of the action registry on purpose: a wait can never be under
 * way at a snapshot, so `'wait'` reaching `createAction` means the rule above
 * broke, and the `abilityDef('wait')` fallback throws instead of decoding it.
 */
export class WaitAction implements Action {
  readonly id = WAIT_ACTION_ID;

  start(unit: Unit, world: World): void {
    world.emit('unit:waited', { unitId: unit.id });
  }

  /** Required by `Action`; never called, since a wait is never serialized. */
  toData(): unknown {
    return {};
  }
}

/**
 * The one wait proposal. It scores 1, as a move does, below every ability that
 * proposes, so the wait wins only when holding is the best thing on offer.
 * Cooldown 0: a unit may wait any number of ticks, one at a time. One frozen
 * instance serves every call, since a wait captures nothing and the selector
 * never mutates a proposal.
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
